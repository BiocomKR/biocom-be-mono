-- 강의-퀴즈 매핑 (lecture_quizzes)
-- Contents ID: 2~22 (21개 강의)
-- Quizzes ID: 64~84 (21개 퀴즈)
-- 1:1 매핑 (day별로 매칭)

INSERT INTO lecture_quizzes (
  content_id,
  quiz_id,
  day,
  sort_order,
  is_active,
  created_at,
  updated_at
) VALUES
-- Day 1
(2, 64, 1, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 2
(3, 65, 2, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 3
(4, 66, 3, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 4
(5, 67, 4, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 5
(6, 68, 5, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 6
(7, 69, 6, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 7
(8, 70, 7, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 8
(9, 71, 8, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 9
(10, 72, 9, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 10
(11, 73, 10, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 11
(12, 74, 11, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 12
(13, 75, 12, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 13
(14, 76, 13, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 14
(15, 77, 14, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 15
(16, 78, 15, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 16
(17, 79, 16, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 17
(18, 80, 17, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 18
(19, 81, 18, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 19
(20, 82, 19, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 20
(21, 83, 20, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW())),
-- Day 21
(22, 84, 21, 1, true, TIMEZONE('Asia/Seoul', NOW()), TIMEZONE('Asia/Seoul', NOW()));
