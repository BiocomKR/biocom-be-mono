-- 21개 칼럼 썸네일 이미지 추가 (content_files)
-- Content ID: 23~43 (칼럼 21개)
-- 이미지는 임시 placeholder URL (실제 이미지 업로드 후 수정 필요)

INSERT INTO content_files (
  content_id,
  file_url,
  file_name,
  file_size,
  mime_type,
  sort_order,
  created_at
) VALUES
-- 칼럼 1 (Content ID 23)
(23, 'https://placeholder-image-url.com/column-1.jpg', '당화-피부노화.jpg', 512000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-27 14:30:00'::timestamp)),

-- 칼럼 2 (Content ID 24)
(24, 'https://placeholder-image-url.com/column-2.jpg', '장피부축.jpg', 498000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-25 09:15:00'::timestamp)),

-- 칼럼 3 (Content ID 25)
(25, 'https://placeholder-image-url.com/column-3.jpg', '미토콘드리아.jpg', 523000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-23 16:45:00'::timestamp)),

-- 칼럼 4 (Content ID 26)
(26, 'https://placeholder-image-url.com/column-4.jpg', '생리주기-피부.jpg', 487000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-21 11:20:00'::timestamp)),

-- 칼럼 5 (Content ID 27)
(27, 'https://placeholder-image-url.com/column-5.jpg', '오메가지방산.jpg', 505000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-19 08:00:00'::timestamp)),

-- 칼럼 6 (Content ID 28)
(28, 'https://placeholder-image-url.com/column-6.jpg', '활성산소-항산화.jpg', 531000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-17 13:30:00'::timestamp)),

-- 칼럼 7 (Content ID 29)
(29, 'https://placeholder-image-url.com/column-7.jpg', '수면-피부재생.jpg', 496000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-15 10:10:00'::timestamp)),

-- 칼럼 8 (Content ID 30)
(30, 'https://placeholder-image-url.com/column-8.jpg', '스트레스-코르티솔.jpg', 518000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-13 15:45:00'::timestamp)),

-- 칼럼 9 (Content ID 31)
(31, 'https://placeholder-image-url.com/column-9.jpg', '인슐린저항성.jpg', 502000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-11 09:30:00'::timestamp)),

-- 칼럼 10 (Content ID 32)
(32, 'https://placeholder-image-url.com/column-10.jpg', '림프순환-붓기.jpg', 489000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-09 14:00:00'::timestamp)),

-- 칼럼 11 (Content ID 33)
(33, 'https://placeholder-image-url.com/column-11.jpg', '비타민D-햇빛.jpg', 527000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-07 11:15:00'::timestamp)),

-- 칼럼 12 (Content ID 34)
(34, 'https://placeholder-image-url.com/column-12.jpg', '콜라겐-비타민C.jpg', 493000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-05 16:20:00'::timestamp)),

-- 칼럼 13 (Content ID 35)
(35, 'https://placeholder-image-url.com/column-13.jpg', '피부장벽-세라마이드.jpg', 515000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-03 08:45:00'::timestamp)),

-- 칼럼 14 (Content ID 36)
(36, 'https://placeholder-image-url.com/column-14.jpg', '간해독-디톡스.jpg', 509000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-10-01 12:30:00'::timestamp)),

-- 칼럼 15 (Content ID 37)
(37, 'https://placeholder-image-url.com/column-15.jpg', '피부타입별-영양소.jpg', 521000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-09-28 10:00:00'::timestamp)),

-- 칼럼 16 (Content ID 38)
(38, 'https://placeholder-image-url.com/column-16.jpg', '중금속해독.jpg', 499000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-09-26 14:15:00'::timestamp)),

-- 칼럼 17 (Content ID 39)
(39, 'https://placeholder-image-url.com/column-17.jpg', '건강한지방.jpg', 512000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-09-24 09:50:00'::timestamp)),

-- 칼럼 18 (Content ID 40)
(40, 'https://placeholder-image-url.com/column-18.jpg', '발효식품-유산균.jpg', 506000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-09-22 15:30:00'::timestamp)),

-- 칼럼 19 (Content ID 41)
(41, 'https://placeholder-image-url.com/column-19.jpg', '식물성단백질.jpg', 494000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-09-19 11:00:00'::timestamp)),

-- 칼럼 20 (Content ID 42)
(42, 'https://placeholder-image-url.com/column-20.jpg', '수분섭취-피부탄력.jpg', 528000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-09-16 13:40:00'::timestamp)),

-- 칼럼 21 (Content ID 43)
(43, 'https://placeholder-image-url.com/column-21.jpg', '바이오해킹.jpg', 517000, 'image/jpeg', 0, TIMEZONE('Asia/Seoul', '2025-09-13 10:20:00'::timestamp));

-- 참고: Content ID는 실제 INSERT 결과에 따라 달라질 수 있습니다.
-- 실제 이미지 URL은 GCS 업로드 후 UPDATE 필요합니다.
