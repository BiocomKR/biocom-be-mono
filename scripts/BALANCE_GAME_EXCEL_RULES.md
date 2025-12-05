# 밸런스게임 엑셀 STEPS 시트 규칙

## step_number와 parent_row_id 생성 규칙

### 기본 구조
```
QUESTION (step=1, parent=null)
  ├─ DIALOGUE (step=2, parent=QUESTION의 row_id)
  │   └─ DIALOGUE (step=3, parent=바로 윗 DIALOGUE의 row_id)
  │       └─ DIALOGUE (step=4, parent=바로 윗 DIALOGUE의 row_id)
  │           └─ RESULT (step=5, parent=바로 윗 DIALOGUE의 row_id)
  │               └─ DIALOGUE (step=2, parent=QUESTION의 row_id) ⚠️ 여기서 2번 분기 시작!
  │                   └─ DIALOGUE (step=3, parent=바로 윗 DIALOGUE의 row_id)
  │                       └─ RESULT (step=4, parent=바로 윗 DIALOGUE의 row_id)
```

### 상세 규칙

1. **QUESTION 타입**
   - `step_number`: 1
   - `parent_row_id`: null
   - 각 challenge_day의 시작점

2. **QUESTION 바로 다음의 DIALOGUE** (1번 분기)
   - `step_number`: 2
   - `parent_row_id`: QUESTION의 row_id

3. **일반 DIALOGUE 체인** (연속된 대화)
   - `step_number`: 바로 윗 행의 step_number + 1
   - `parent_row_id`: 바로 윗 행의 row_id

4. **RESULT 타입**
   - `step_number`: 바로 윗 행의 step_number + 1
   - `parent_row_id`: 바로 윗 행의 row_id

5. **⚠️ RESULT 다음의 DIALOGUE** (2번 분기 시작!)
   - `step_number`: 2 (다시 2부터 시작!)
   - `parent_row_id`: 현재 challenge_day의 QUESTION의 row_id
   - **핵심**: RESULT 다음에 나오는 DIALOGUE는 새로운 분기의 시작점

### 예시 (1일차 기준)

```
row_id | step_type | step_number | parent_row_id | 설명
-------|-----------|-------------|---------------|------
28     | QUESTION  | 1           | null          | 질문
29     | DIALOGUE  | 2           | 28            | 1번 분기 시작
30     | DIALOGUE  | 3           | 29            | 체인 계속
31     | DIALOGUE  | 4           | 30            | 체인 계속
32     | RESULT    | 5           | 31            | 1번 분기 종료
33     | DIALOGUE  | 2           | 28            | ⚠️ 2번 분기 시작! (parent는 QUESTION)
34     | DIALOGUE  | 3           | 33            | 체인 계속
35     | RESULT    | 4           | 34            | 2번 분기 종료
```

### 스크립트 구현 로직

```javascript
if (currentRow.step_type === 'QUESTION') {
  newStepNumber = 1;
  newParentRowId = null;
  currentQuestion = currentRow; // QUESTION 저장

} else if (currentRow.step_type === 'DIALOGUE') {
  if (prevRow && prevRow.step_type === 'RESULT') {
    // ⚠️ RESULT 다음 DIALOGUE: 2번 분기 시작!
    newStepNumber = 2;
    newParentRowId = currentQuestion.row_id; // parent는 QUESTION!
  } else if (prevRow && prevRow.step_type === 'QUESTION') {
    // QUESTION 바로 다음: 1번 분기 시작
    newStepNumber = 2;
    newParentRowId = currentQuestion.row_id;
  } else if (prevRow) {
    // 일반 체인: 계속 이어짐
    newStepNumber = (prevRow.step_number || prevRow.newStepNumber || 1) + 1;
    newParentRowId = prevRow.row_id;
  }

} else if (currentRow.step_type === 'RESULT') {
  // 일반 체인 끝
  newStepNumber = (prevRow.step_number || prevRow.newStepNumber || 1) + 1;
  newParentRowId = prevRow.row_id;
}
```

## 주의사항

1. **currentQuestion 변수**: 각 challenge_day의 QUESTION row를 반드시 저장해야 함
2. **RESULT 다음 체크**: RESULT 다음의 DIALOGUE가 새 분기 시작점
3. **step_number 리셋**: 새 분기 시작 시 step_number는 다시 2부터 시작
4. **parent 참조**: 새 분기의 parent는 현재 QUESTION의 row_id

---

**작성일**: 2025-12-04
**작성자**: Claude Code
**용도**: 엑셀 원천데이터 수정 시 참고용
