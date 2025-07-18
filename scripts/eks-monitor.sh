#!/bin/bash
# 🚀 EKS 심플 모니터링 도구
# 
# 단순하고 강력한 모니터링 - 필수 기능만!
#
# 사용법: ./2-monitor-simple.sh
# 
# 작성자: Claude Code & 바이브코딩
# 버전: 2.0.0 (Simplified)

# 🎨 터미널 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 🔧 동적으로 리소스 찾기
APP_LABEL="app.kubernetes.io/name=backend-api"
DEPLOYMENT_NAME=$(kubectl get deployment -l $APP_LABEL -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
SERVICE_NAME=$(kubectl get svc -l $APP_LABEL -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
INGRESS_NAME=$(kubectl get ingress -l $APP_LABEL -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
HPA_NAME=$(kubectl get hpa -l $APP_LABEL -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

# 🎯 메인 메뉴
show_menu() {
    clear
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}                          🔍 EKS 심플 모니터링 v2.0                          ${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    if [ -z "$DEPLOYMENT_NAME" ]; then
        echo -e "${RED}⚠️  주의: 배포된 애플리케이션을 찾을 수 없습니다${NC}"
        echo -e "${YELLOW}   kubectl get deployment 명령으로 확인해보세요${NC}"
        echo ""
    fi
    
    echo -e "${GREEN}📊 핵심 기능${NC}"
    echo "  1) 전체 상태 보기         - 클러스터, Pod, 서비스, ALB 한눈에"
    echo "  2) 실시간 로그 보기       - Pod 로그 스트리밍"
    echo "  3) Pod 쉘 접속            - 컨테이너 직접 디버깅"
    echo ""
    echo -e "${RED}⚡ 액션${NC}"
    echo "  4) 앱 재시작              - Rolling restart"
    echo "  5) 부하 테스트            - Artillery 스트레스 테스트"
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 🔄 무한 루프
while true; do
    show_menu
    read -p "🎯 선택하세요 (1-5, q:종료): " choice
    
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
        echo ""
        
        # 노드 상태
        echo -e "${PURPLE}[ 노드 상태 ]${NC}"
        kubectl get nodes -o wide
        echo ""
        
        # Pod 상태
        echo -e "${PURPLE}[ Pod 상태 ]${NC}"
        kubectl get pods -l $APP_LABEL -o wide
        echo ""
        
        # 서비스 상태
        if [ ! -z "$SERVICE_NAME" ]; then
            echo -e "${PURPLE}[ 서비스 상태 ]${NC}"
            kubectl get svc $SERVICE_NAME
            echo ""
        fi
        
        # ALB 상태
        if [ ! -z "$INGRESS_NAME" ]; then
            echo -e "${PURPLE}[ 외부 접속 정보 ]${NC}"
            ALB=$(kubectl get ingress $INGRESS_NAME -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
            if [ -z "$ALB" ]; then
                echo -e "${YELLOW}⏳ ALB 생성 중...${NC}"
            else
                echo -e "🌐 ALB: ${BLUE}http://$ALB${NC}"
                echo -e "📚 API 문서: ${BLUE}http://$ALB/api/docs${NC}"
                echo -e "🏥 헬스체크: ${BLUE}http://$ALB/api/health${NC}"
            fi
            echo ""
        fi
        
        # HPA 상태
        if [ ! -z "$HPA_NAME" ]; then
            echo -e "${PURPLE}[ 오토스케일링 상태 ]${NC}"
            kubectl get hpa $HPA_NAME
            echo ""
        fi
        
        # 상태 체크
        echo -e "${PURPLE}[ 상태 요약 ]${NC}"
        running_pods=$(kubectl get pods -l $APP_LABEL --no-headers 2>/dev/null | grep Running | wc -l)
        total_pods=$(kubectl get pods -l $APP_LABEL --no-headers 2>/dev/null | wc -l)
        echo -e "✅ 실행 중인 Pod: ${GREEN}$running_pods/$total_pods${NC}"
        ;;
        
    2)  # 📝 실시간 로그 보기
        echo ""
        echo -e "${CYAN}━━━ 실시간 로그 보기 ━━━${NC}"
        
        # Pod 목록
        echo -e "${GREEN}🔍 실행 중인 Pod 목록:${NC}"
        kubectl get pods -l $APP_LABEL --no-headers | awk '{print NR") " $1 " (" $3 ")"}'
        
        echo ""
        read -p "Pod 번호 선택 (Enter=첫 번째): " pod_choice
        
        # Pod 이름 추출
        if [ -z "$pod_choice" ]; then
            pod_name=$(kubectl get pods -l $APP_LABEL -o jsonpath='{.items[0].metadata.name}')
        else
            pod_name=$(kubectl get pods -l $APP_LABEL --no-headers | awk "NR==$pod_choice {print \$1}")
        fi
        
        if [ -z "$pod_name" ]; then
            echo -e "${RED}❌ Pod를 찾을 수 없습니다${NC}"
        else
            echo ""
            echo -e "${GREEN}📝 $pod_name 로그 스트리밍 시작...${NC}"
            echo -e "${YELLOW}💡 팁: Ctrl+C로 종료${NC}"
            echo ""
            kubectl logs -f $pod_name
        fi
        ;;
        
    3)  # 🚀 Pod 쉘 접속
        echo ""
        echo -e "${CYAN}━━━ Pod 쉘 접속 ━━━${NC}"
        
        # Pod 목록
        echo -e "${GREEN}🔍 실행 중인 Pod 목록:${NC}"
        kubectl get pods -l $APP_LABEL --no-headers | awk '{print NR") " $1 " (" $3 ")"}'
        
        echo ""
        read -p "Pod 번호 선택: " pod_choice
        
        # Pod 이름 추출
        pod_name=$(kubectl get pods -l $APP_LABEL --no-headers | awk "NR==$pod_choice {print \$1}")
        
        if [ -z "$pod_name" ]; then
            echo -e "${RED}❌ Pod를 찾을 수 없습니다${NC}"
        else
            echo ""
            echo -e "${GREEN}🚀 $pod_name 쉘 접속 중...${NC}"
            echo -e "${YELLOW}💡 팁: 'exit' 명령으로 나가기${NC}"
            echo ""
            kubectl exec -it $pod_name -- /bin/sh
        fi
        ;;
        
    4)  # 🔄 앱 재시작
        echo ""
        echo -e "${CYAN}━━━ 애플리케이션 재시작 ━━━${NC}"
        echo ""
        
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
                kubectl rollout restart deployment/$DEPLOYMENT_NAME
                
                echo ""
                echo -e "${GREEN}📊 롤아웃 진행 상황:${NC}"
                kubectl rollout status deployment/$DEPLOYMENT_NAME
                
                echo ""
                echo -e "${GREEN}✅ 재시작 완료!${NC}"
            else
                echo -e "${YELLOW}취소되었습니다${NC}"
            fi
        fi
        ;;
        
    5)  # 💣 부하 테스트
        echo ""
        echo -e "${CYAN}━━━ 부하 테스트 (Artillery) ━━━${NC}"
        
        # Artillery 확인
        if ! command -v artillery &> /dev/null; then
            echo -e "${RED}❌ Artillery가 설치되어 있지 않습니다${NC}"
            echo -e "${YELLOW}설치 명령: npm install -g artillery${NC}"
        else
            # ALB 주소 확인
            ALB=$(kubectl get ingress $INGRESS_NAME -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
            if [ -z "$ALB" ]; then
                echo -e "${RED}❌ ALB 주소를 찾을 수 없습니다${NC}"
            else
                echo ""
                echo -e "${GREEN}🎯 테스트 대상: ${BLUE}http://$ALB/api/health${NC}"
                echo ""
                echo -e "${PURPLE}부하 테스트 시나리오:${NC}"
                echo "  1) 🟢 가벼운 테스트  - 100 요청, 10 동시 사용자"
                echo "  2) 🟡 중간 테스트    - 1000 요청, 50 동시 사용자"
                echo "  3) 🔴 무거운 테스트  - 5000 요청, 100 동시 사용자"
                echo ""
                read -p "시나리오 선택 (1-3): " load_choice
                
                echo ""
                echo -e "${GREEN}🚀 테스트 시작!${NC}"
                echo ""
                
                case $load_choice in
                    1) artillery quick -n 100 -c 10 http://$ALB/api/health ;;
                    2) artillery quick -n 1000 -c 50 http://$ALB/api/health ;;
                    3) artillery quick -n 5000 -c 100 http://$ALB/api/health ;;
                    *) echo -e "${RED}잘못된 선택${NC}" ;;
                esac
                
                echo ""
                echo -e "${GREEN}✅ 테스트 완료!${NC}"
            fi
        fi
        ;;
        
    *)
        echo -e "${RED}❌ 잘못된 선택입니다. 1-5 중에서 선택하세요.${NC}"
        ;;
    esac
    
    # 메뉴로 돌아가기
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    read -p "⏎ Enter를 눌러 메뉴로 돌아가기... "
done