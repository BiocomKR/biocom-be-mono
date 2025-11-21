#!/usr/bin/env python3
"""
AI Agent Statistics API 호출 클라이언트
AES-256-GCM 암호화를 사용하여 차트ID를 암호화하고 API 호출
ENCRYPTION_KEY="b!@c@m2@25!@#$@creTkEy!2E45bT8@"
"""

import os
import json
import base64
import hashlib
import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend


class CryptoUtil:
    """AES-256-GCM 암호화/복호화 유틸리티"""

    def __init__(self, encryption_key: str = None):
        """
        초기화
        :param encryption_key: 32바이트 암호화 키 (없으면 환경변수에서 읽음)
        """
        key = encryption_key or os.getenv('ENCRYPTION_KEY')
        if not key:
            raise ValueError("ENCRYPTION_KEY 환경변수가 설정되어 있지 않습니다.")

        # 키가 32바이트가 아니면 SHA256으로 해시
        if len(key.encode()) != 32:
            self.key = hashlib.sha256(key.encode()).digest()
        else:
            self.key = key.encode()

    def encrypt(self, text: str) -> str:
        """
        문자열 암호화
        :param text: 암호화할 평문
        :return: Base64 인코딩된 암호문
        """
        if not text:
            return text

        try:
            # AESGCM 인스턴스 생성
            aesgcm = AESGCM(self.key)

            # 16바이트 IV 생성
            iv = os.urandom(16)

            # 암호화 (GCM 모드는 자동으로 인증태그 생성)
            ciphertext = aesgcm.encrypt(iv, text.encode('utf-8'), None)

            # IV + 암호문(인증태그 포함) 결합
            combined = iv + ciphertext

            # Base64 인코딩
            return base64.b64encode(combined).decode('utf-8')

        except Exception as e:
            print(f"암호화 실패: {e}")
            raise

    def decrypt(self, encrypted_text: str) -> str:
        """
        문자열 복호화
        :param encrypted_text: Base64 인코딩된 암호문
        :return: 복호화된 평문
        """
        if not encrypted_text:
            return encrypted_text

        try:
            # Base64 디코딩
            combined = base64.b64decode(encrypted_text)

            # IV와 암호문 분리
            iv = combined[:16]
            ciphertext = combined[16:]

            # AESGCM 인스턴스 생성
            aesgcm = AESGCM(self.key)

            # 복호화
            plaintext = aesgcm.decrypt(iv, ciphertext, None)

            return plaintext.decode('utf-8')

        except Exception as e:
            print(f"복호화 실패: {e}")
            return encrypted_text


class AiAgentApiClient:
    """AI Agent Statistics API 클라이언트"""

    def __init__(self, base_url: str = "http://localhost:10804", encryption_key: str = None):
        """
        초기화
        :param base_url: API 서버 주소
        :param encryption_key: 암호화 키
        """
        self.base_url = base_url
        self.crypto = CryptoUtil(encryption_key)

    def get_statistics(self, chart_id: str) -> dict:
        """
        AI Agent 통계 조회
        :param chart_id: 차트ID (예: TA11150002)
        :return: API 응답 JSON
        """
        # 차트ID 암호화
        encrypted_token = self.crypto.encrypt(chart_id)

        # API 호출
        url = f"{self.base_url}/api/tracking/statistics/ai-agent"
        headers = {
            'x-token': encrypted_token,
            'Content-Type': 'application/json'
        }

        print(f"[요청] {url}")
        print(f"[차트ID] {chart_id}")
        print(f"[암호화된 토큰] {encrypted_token[:50]}...")

        response = requests.get(url, headers=headers)

        print(f"[응답 상태] {response.status_code}")

        if response.status_code != 200:
            print(f"[에러] {response.text}")
            response.raise_for_status()

        return response.json()


def main():
    """메인 함수 - 사용 예시"""

    # .env 파일에서 환경변수 로드 (선택사항)
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        print("python-dotenv 패키지가 설치되지 않았습니다. (선택사항)")

    # API 클라이언트 생성
    client = AiAgentApiClient(
        base_url="http://localhost:10804",
        # encryption_key는 환경변수에서 자동으로 읽음
    )

    # 테스트용 차트ID
    chart_id = "TA11150002"

    try:
        # 통계 조회
        result = client.get_statistics(chart_id)

        # 결과 출력
        print("\n[성공]")
        print(json.dumps(result, indent=2, ensure_ascii=False))

    except Exception as e:
        print(f"\n[실패] {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
