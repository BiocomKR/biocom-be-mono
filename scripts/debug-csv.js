const fs = require('fs');

function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  console.log('Headers:', headers);

  const data = [];
  for (let i = 1; i < lines.length && i <= 3; i++) { // 처음 3개 행만 확인
    if (lines[i].trim() === '') continue;

    const values = lines[i].split(',');
    console.log(`Row ${i}:`, values);

    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] ? values[index].trim() : '';
    });

    console.log(`Parsed row ${i}:`, row);
    data.push(row);
  }

  return data;
}

// CSV 파일 읽기 및 디버깅
const csvContent = fs.readFileSync('/Users/daegilchoi/Desktop/도시락엑셀.csv', 'utf-8');
console.log('CSV content first 200 chars:');
console.log(csvContent.substring(0, 200));
console.log('\n=== Parsing ===');
parseCSV(csvContent);