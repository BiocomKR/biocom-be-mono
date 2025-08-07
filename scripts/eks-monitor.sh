#!/bin/bash
# 🚀 EKS 모니터링 도구 - biocom-api 전용
# 
# 사용법: ./eks-monitor.sh [dev|prod]
# 
# 작성자: Claude Code & 바이브코딩
# 버전: 3.0.0

# 🎨 터미널 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 스크립트의 디렉토리 찾기
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 환경 설정
ENVIRONMENT=${1:-dev}

if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
    echo -e "${RED}❌ 잘못된 환경입니다. 'dev' 또는 'prod'를 선택하세요${NC}"
    echo -e "사용법: $0 [dev|prod]"
    exit 1
fi

# 환경별 설정 파일 로드
ENV_FILE="$PROJECT_ROOT/.env.eks.$ENVIRONMENT"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ 환경 설정 파일을 찾을 수 없습니다: $ENV_FILE${NC}"
    exit 1
fi

# 환경 변수 로드
source "$ENV_FILE"

# 기본값 설정
NAMESPACE=${NAMESPACE:-default}
APP_NAME=${HELM_RELEASE_NAME:-biocom-api}

# 🔧 동적으로 리소스 찾기
APP_LABEL="app.kubernetes.io/instance=$APP_NAME"

# kubectl 연결 확인
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}❌ Kubernetes 클러스터에 연결할 수 없습니다${NC}"
    echo -e "${YELLOW}kubectl 설정을 확인하세요${NC}"
    exit 1
fi

# 리소스 이름 가져오기
get_resource_names() {
    DEPLOYMENT_NAME=$(kubectl get deployment -n $NAMESPACE -l $APP_LABEL -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    SERVICE_NAME=$(kubectl get svc -n $NAMESPACE -l $APP_LABEL -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    INGRESS_NAME=$(kubectl get ingress -n $NAMESPACE -l $APP_LABEL -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    HPA_NAME=$(kubectl get hpa -n $NAMESPACE -l $APP_LABEL -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
}

# 초기 리소스 확인
get_resource_names

# 🎯 메인 메뉴
show_menu() {
    clear
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}                       🔍 EKS 모니터링 v3.0 - $ENVIRONMENT 환경                       ${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${CYAN}클러스터: ${YELLOW}$CLUSTER_NAME${NC}"
    echo -e "${CYAN}네임스페이스: ${YELLOW}$NAMESPACE${NC}"
    echo -e "${CYAN}애플리케이션: ${YELLOW}$APP_NAME${NC}"
    echo ""
    
    if [ -z "$DEPLOYMENT_NAME" ]; then
        echo -e "${RED}⚠️  주의: 배포된 애플리케이션을 찾을 수 없습니다${NC}"
        echo -e "${YELLOW}   배포가 완료되었는지 확인해보세요${NC}"
        echo ""
    fi
    
    echo -e "${GREEN}📊 모니터링${NC}"
    echo "  1) 전체 상태 보기         - 클러스터, Pod, 서비스, ALB 한눈에"
    echo "  2) 실시간 로그 보기       - Pod 로그 스트리밍"
    echo "  3) Pod 상세 정보          - CPU/Memory 사용량 포함"
    echo "  4) 최근 이벤트            - 클러스터 이벤트 확인"
    echo ""
    echo -e "${BLUE}🔧 디버깅${NC}"
    echo "  5) Pod 쉘 접속            - 컨테이너 직접 디버깅"
    echo "  6) 환경변수 확인          - Pod 내부 환경변수"
    echo "  7) 네트워크 테스트        - 연결성 확인"
    echo ""
    echo -e "${RED}⚡ 운영 작업${NC}"
    echo "  8) 앱 재시작              - Rolling restart"
    echo "  9) 스케일 조정            - Pod 개수 변경"
    echo "  10) 부하 테스트           - API 스트레스 테스트"
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 헬퍼 함수: Pod 선택
select_pod() {
    local pods=($(kubectl get pods -n $NAMESPACE -l $APP_LABEL -o jsonpath='{.items[*].metadata.name}' 2>/dev/null))
    
    if [ ${#pods[@]} -eq 0 ]; then
        echo -e "${RED}❌ 실행 중인 Pod를 찾을 수 없습니다${NC}"
        return 1
    fi
    
    if [ ${#pods[@]} -eq 1 ]; then
        POD_NAME="${pods[0]}"
        return 0
    fi
    
    echo -e "${GREEN}🔍 실행 중인 Pod 목록:${NC}"
    for i in "${!pods[@]}"; do
        local status=$(kubectl get pod -n $NAMESPACE ${pods[$i]} -o jsonpath='{.status.phase}')
        echo "  $((i+1))) ${pods[$i]} ($status)"
    done
    
    echo ""
    read -p "Pod 번호 선택 (Enter=첫 번째): " pod_choice
    
    if [ -z "$pod_choice" ]; then
        pod_choice=1
    fi
    
    if [ $pod_choice -lt 1 ] || [ $pod_choice -gt ${#pods[@]} ]; then
        echo -e "${RED}❌ 잘못된 선택입니다${NC}"
        return 1
    fi
    
    POD_NAME="${pods[$((pod_choice-1))]}"
    return 0
}

# 🔄 무한 루프
while true; do
    show_menu
    read -p "🎯 선택하세요 (1-10, q:종료): " choice
    
    # 종료 옵션
    if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
        echo -e "${GREEN}👋 모니터링을 종료합니다.${NC}"
        exit 0
    fi
    
    case $choice in
    1)  # 📊 전체 상태 보기
        echo ""
        echo -e "${CYAN}━━━ 전체 클러스터 상태 ━━━${NC}"
        echo ""
        
        # 클러스터 정보
        echo -e "${PURPLE}[ 클러스터 정보 ]${NC}"
        kubectl cluster-info | head -1
        echo "환경: $ENVIRONMENT"
        echo ""
        
        # 노드 상태
        echo -e "${PURPLE}[ 노드 상태 ]${NC}"
        kubectl get nodes -o wide
        echo ""
        
        # Pod 상태
        echo -e "${PURPLE}[ Pod 상태 ]${NC}"
        kubectl get pods -n $NAMESPACE -l $APP_LABEL -o wide
        echo ""
        
        # 서비스 상태
        if [ ! -z "$SERVICE_NAME" ]; then
            echo -e "${PURPLE}[ 서비스 상태 ]${NC}"
            kubectl get svc -n $NAMESPACE $SERVICE_NAME
            echo ""
        fi
        
        # ALB 상태
        if [ ! -z "$INGRESS_NAME" ]; then
            echo -e "${PURPLE}[ 외부 접속 정보 ]${NC}"
            ALB=$(kubectl get ingress -n $NAMESPACE $INGRESS_NAME -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
            if [ -z "$ALB" ]; then
                echo -e "${YELLOW}⏳ ALB 생성 중...${NC}"
            else
                echo -e "🌐 ALB: ${BLUE}https://$ALB${NC}"
                echo -e "📚 API 문서: ${BLUE}https://$ALB/api/docs${NC}"
                echo -e "🏥 헬스체크: ${BLUE}https://$ALB/api/health${NC}"
                
                # 도메인 정보
                if [ ! -z "$INGRESS_HOST" ]; then
                    echo -e "🌍 도메인: ${BLUE}https://$INGRESS_HOST${NC}"
                fi
            fi
            echo ""
        fi
        
        # HPA 상태
        if [ ! -z "$HPA_NAME" ]; then
            echo -e "${PURPLE}[ 오토스케일링 상태 ]${NC}"
            kubectl get hpa -n $NAMESPACE $HPA_NAME
            echo ""
        fi
        
        # 상태 요약
        echo -e "${PURPLE}[ 상태 요약 ]${NC}"
        running_pods=$(kubectl get pods -n $NAMESPACE -l $APP_LABEL --no-headers 2>/dev/null | grep Running | wc -l | tr -d ' ')
        total_pods=$(kubectl get pods -n $NAMESPACE -l $APP_LABEL --no-headers 2>/dev/null | wc -l | tr -d ' ')
        echo -e "✅ 실행 중인 Pod: ${GREEN}$running_pods/$total_pods${NC}"
        
        # PVC 상태
        echo ""
        echo -e "${PURPLE}[ 스토리지 상태 ]${NC}"
        kubectl get pvc -n $NAMESPACE 2>/dev/null || echo "PVC 없음"
        ;;
        
    2)  # 📝 실시간 로그 보기
        echo ""
        echo -e "${CYAN}━━━ 실시간 로그 보기 ━━━${NC}"
        
        if select_pod; then
            echo ""
            echo -e "${GREEN}📝 $POD_NAME 로그 스트리밍 시작...${NC}"
            echo -e "${YELLOW}💡 팁: Ctrl+C로 종료${NC}"
            echo ""
            
            # 로그 옵션 선택
            echo "로그 옵션:"
            echo "  1) 전체 로그 (기본)"
            echo "  2) 최근 100줄부터"
            echo "  3) 에러 로그만"
            read -p "선택 (Enter=1): " log_option
            
            case ${log_option:-1} in
                1) kubectl logs -f -n $NAMESPACE $POD_NAME ;;
                2) kubectl logs -f -n $NAMESPACE $POD_NAME --tail=100 ;;
                3) kubectl logs -f -n $NAMESPACE $POD_NAME | grep -E "(ERROR|Error|error|FAIL|Fail|fail)" ;;
            esac
        fi
        ;;
        
    3)  # 📊 Pod 상세 정보
        echo ""
        echo -e "${CYAN}━━━ Pod 상세 정보 ━━━${NC}"
        
        if select_pod; then
            echo ""
            echo -e "${PURPLE}[ Pod 기본 정보 ]${NC}"
            kubectl describe pod -n $NAMESPACE $POD_NAME | grep -E "(Name:|Status:|Node:|IP:|Created:)"
            
            echo ""
            echo -e "${PURPLE}[ 리소스 사용량 ]${NC}"
            kubectl top pod -n $NAMESPACE $POD_NAME 2>/dev/null || echo "메트릭 서버가 설치되지 않았습니다"
            
            echo ""
            echo -e "${PURPLE}[ 컨테이너 상태 ]${NC}"
            kubectl get pod -n $NAMESPACE $POD_NAME -o jsonpath='{range .status.containerStatuses[*]}{.name}{"\t"}{.state}{"\n"}{end}'
        fi
        ;;
        
    4)  # 📋 최근 이벤트
        echo ""
        echo -e "${CYAN}━━━ 최근 이벤트 (최근 30분) ━━━${NC}"
        echo ""
        kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -20
        ;;
        
    5)  # 🚀 Pod 쉘 접속
        echo ""
        echo -e "${CYAN}━━━ Pod 쉘 접속 ━━━${NC}"
        
        if select_pod; then
            echo ""
            echo -e "${GREEN}🚀 $POD_NAME 쉘 접속 중...${NC}"
            echo -e "${YELLOW}💡 팁: 'exit' 명령으로 나가기${NC}"
            echo ""
            
            # 사용 가능한 쉘 찾기
            for shell in "/bin/bash" "/bin/sh" "/bin/ash"; do
                if kubectl exec -n $NAMESPACE $POD_NAME -- test -x $shell 2>/dev/null; then
                    kubectl exec -it -n $NAMESPACE $POD_NAME -- $shell
                    break
                fi
            done
        fi
        ;;
        
    6)  # 🔍 환경변수 확인
        echo ""
        echo -e "${CYAN}━━━ Pod 환경변수 확인 ━━━${NC}"
        
        if select_pod; then
            echo ""
            echo -e "${PURPLE}[ 환경변수 목록 ]${NC}"
            kubectl exec -n $NAMESPACE $POD_NAME -- env | sort | grep -v -E "(PASSWORD|SECRET|KEY)" || true
            
            echo ""
            echo -e "${YELLOW}⚠️  보안상 PASSWORD, SECRET, KEY가 포함된 변수는 제외되었습니다${NC}"
        fi
        ;;
        
    7)  # 🌐 네트워크 테스트
        echo ""
        echo -e "${CYAN}━━━ 네트워크 테스트 ━━━${NC}"
        
        if select_pod; then
            echo ""
            echo -e "${PURPLE}[ 내부 연결성 테스트 ]${NC}"
            
            # DNS 테스트
            echo "1. DNS 확인:"
            kubectl exec -n $NAMESPACE $POD_NAME -- nslookup kubernetes.default 2>/dev/null || echo "nslookup 명령어 없음"
            
            echo ""
            echo "2. 서비스 연결 테스트:"
            if [ ! -z "$SERVICE_NAME" ]; then
                kubectl exec -n $NAMESPACE $POD_NAME -- wget -O- -T 5 http://$SERVICE_NAME:3000/api/health 2>&1 | head -10 || echo "연결 실패"
            fi
            
            echo ""
            echo "3. 외부 연결 테스트:"
            kubectl exec -n $NAMESPACE $POD_NAME -- wget -O- -T 5 https://api.github.com 2>&1 | head -5 || echo "외부 연결 실패"
        fi
        ;;
        
    8)  # 🔄 앱 재시작
        echo ""
        echo -e "${CYAN}━━━ 애플리케이션 재시작 ━━━${NC}"
        echo ""
        
        # 리소스 이름 갱신
        get_resource_names
        
        if [ -z "$DEPLOYMENT_NAME" ]; then
            echo -e "${RED}❌ Deployment를 찾을 수 없습니다${NC}"
        else
            echo -e "${YELLOW}⚠️  주의: Rolling restart를 수행합니다${NC}"
            echo "- 무중단 재시작 (새 Pod 생성 → 기존 Pod 종료)"
            echo "- 약 1-2분 소요"
            echo ""
            read -p "정말로 재시작하시겠습니까? (y/n): " -n 1 -r
            echo ""
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo -e "${GREEN}🔄 재시작 시작...${NC}"
                kubectl rollout restart deployment/$DEPLOYMENT_NAME -n $NAMESPACE
                
                echo ""
                echo -e "${GREEN}📊 롤아웃 진행 상황:${NC}"
                kubectl rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE --timeout=300s
                
                echo ""
                echo -e "${GREEN}✅ 재시작 완료!${NC}"
            else
                echo -e "${YELLOW}취소되었습니다${NC}"
            fi
        fi
        ;;
        
    9)  # 📈 스케일 조정
        echo ""
        echo -e "${CYAN}━━━ 스케일 조정 ━━━${NC}"
        echo ""
        
        # 리소스 이름 갱신
        get_resource_names
        
        if [ -z "$DEPLOYMENT_NAME" ]; then
            echo -e "${RED}❌ Deployment를 찾을 수 없습니다${NC}"
        else
            current_replicas=$(kubectl get deployment -n $NAMESPACE $DEPLOYMENT_NAME -o jsonpath='{.spec.replicas}')
            echo -e "현재 Pod 개수: ${YELLOW}$current_replicas${NC}"
            echo ""
            
            read -p "새로운 Pod 개수 입력 (1-10): " new_replicas
            
            if [[ $new_replicas =~ ^[0-9]+$ ]] && [ $new_replicas -ge 1 ] && [ $new_replicas -le 10 ]; then
                echo -e "${GREEN}🔄 스케일 조정 중...${NC}"
                kubectl scale deployment/$DEPLOYMENT_NAME -n $NAMESPACE --replicas=$new_replicas
                
                echo ""
                echo -e "${GREEN}📊 스케일 진행 상황:${NC}"
                kubectl rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE --timeout=300s
                
                echo ""
                echo -e "${GREEN}✅ 스케일 조정 완료! (${current_replicas} → ${new_replicas})${NC}"
            else
                echo -e "${RED}❌ 잘못된 입력입니다 (1-10 사이의 숫자)${NC}"
            fi
        fi
        ;;
        
    10)  # 💣 부하 테스트
        echo ""
        echo -e "${CYAN}━━━ 부하 테스트 ━━━${NC}"
        
        # ALB 주소 확인
        if [ -z "$INGRESS_NAME" ]; then
            echo -e "${RED}❌ Ingress를 찾을 수 없습니다${NC}"
        else
            ALB=$(kubectl get ingress -n $NAMESPACE $INGRESS_NAME -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
            if [ -z "$ALB" ]; then
                echo -e "${RED}❌ ALB 주소를 찾을 수 없습니다${NC}"
            else
                # 테스트 URL 설정
                if [ ! -z "$INGRESS_HOST" ]; then
                    TEST_URL="https://$INGRESS_HOST/api/health"
                else
                    TEST_URL="https://$ALB/api/health"
                fi
                
                echo ""
                echo -e "${GREEN}🎯 테스트 대상: ${BLUE}$TEST_URL${NC}"
                echo ""
                echo -e "${PURPLE}부하 테스트 시나리오:${NC}"
                echo "  1) 🟢 연결 테스트    - 단순 연결 확인"
                echo "  2) 🟡 가벼운 테스트  - 10초간 초당 10 요청"
                echo "  3) 🔴 무거운 테스트  - 30초간 초당 50 요청"
                echo ""
                read -p "시나리오 선택 (1-3): " load_choice
                
                echo ""
                echo -e "${GREEN}🚀 테스트 시작!${NC}"
                echo ""
                
                case $load_choice in
                    1) 
                        echo "연결 테스트 중..."
                        curl -k -s -o /dev/null -w "HTTP Status: %{http_code}\nTotal Time: %{time_total}s\n" $TEST_URL
                        ;;
                    2) 
                        if command -v ab &> /dev/null; then
                            ab -n 100 -c 10 -t 10 $TEST_URL
                        else
                            echo -e "${YELLOW}Apache Bench(ab)가 설치되지 않았습니다. curl로 대체합니다.${NC}"
                            for i in {1..10}; do
                                curl -k -s -o /dev/null -w "Request $i: %{http_code} - %{time_total}s\n" $TEST_URL &
                            done
                            wait
                        fi
                        ;;
                    3) 
                        if command -v ab &> /dev/null; then
                            ab -n 1500 -c 50 -t 30 $TEST_URL
                        else
                            echo -e "${RED}무거운 테스트는 Apache Bench(ab) 설치가 필요합니다${NC}"
                            echo -e "${YELLOW}설치: apt-get install apache2-utils (또는 brew install ab)${NC}"
                        fi
                        ;;
                    *) echo -e "${RED}잘못된 선택${NC}" ;;
                esac
                
                echo ""
                echo -e "${GREEN}✅ 테스트 완료!${NC}"
                
                # HPA 상태 확인
                if [ ! -z "$HPA_NAME" ]; then
                    echo ""
                    echo -e "${PURPLE}[ 오토스케일링 반응 ]${NC}"
                    kubectl get hpa -n $NAMESPACE $HPA_NAME
                fi
            fi
        fi
        ;;
        
    *)
        echo -e "${RED}❌ 잘못된 선택입니다. 1-10 중에서 선택하세요.${NC}"
        ;;
    esac
    
    # 메뉴로 돌아가기
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    read -p "⏎ Enter를 눌러 메뉴로 돌아가기... "
done