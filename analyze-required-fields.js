const fs = require('fs');
const path = require('path');

// 스키마 파일 읽기
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// 각 모델의 필수 필드 파악
const models = {};

// 모델을 하나씩 추출
const lines = schemaContent.split('\n');
let currentModel = null;
let inModel = false;
let braceCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // 모델 시작
  if (trimmed.startsWith('model ')) {
    const modelMatch = trimmed.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      currentModel = modelMatch[1];
      models[currentModel] = [];
      inModel = true;
      braceCount = 1;
    }
    continue;
  }

  if (!inModel || !currentModel) continue;

  // 중괄호 카운트
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }

  // 모델 종료
  if (braceCount === 0) {
    inModel = false;
    currentModel = null;
    continue;
  }

  // 필드 파싱
  if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('@@') && !trimmed.startsWith('///')) {
    // 필드 형식: fieldName Type? 나머지...
    const fieldMatch = trimmed.match(/^(\w+)\s+([^\s]+)/);
    if (fieldMatch) {
      const fieldName = fieldMatch[1];
      const fieldTypeRaw = fieldMatch[2];

      // Type?인 경우 isOptional = true
      const isOptional = fieldTypeRaw.includes('?');
      const fieldType = fieldTypeRaw.replace('?', '');

      const hasDefault = trimmed.includes('@default');
      const isRelation = trimmed.includes('@relation') || trimmed.includes('fields:') || trimmed.includes('references:');

      // 관계 필드 판별: 타입이 대문자로 시작하거나 배열인 경우
      const isRelationType = /^[A-Z]/.test(fieldType) || fieldType.includes('[]');

      // 필수 필드: optional이 아니고, default도 없고, relation도 아닌 경우
      if (!isOptional && !hasDefault && !isRelation && !isRelationType) {
        models[currentModel].push({
          name: fieldName,
          type: fieldType,
          line: trimmed
        });
      }
    }
  }
}

// 결과를 JSON으로 저장
const outputPath = path.join(__dirname, 'required-fields.json');
fs.writeFileSync(outputPath, JSON.stringify(models, null, 2));

console.log('모델별 필수 필드:');
console.log('================');
for (const [modelName, fields] of Object.entries(models)) {
  if (fields.length > 0) {
    console.log(`\n${modelName}:`);
    fields.forEach(f => console.log(`  - ${f.name} (${f.type})`));
  }
}

console.log(`\n\n결과가 ${outputPath}에 저장되었습니다.`);
