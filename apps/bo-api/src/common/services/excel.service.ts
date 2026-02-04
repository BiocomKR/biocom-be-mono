import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

/**
 * 엑셀 컬럼 정의 인터페이스
 */
export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  style?: Partial<ExcelJS.Style>;
  // 데이터 포맷터 (원본 값 -> 표시할 값)
  formatter?: (value: any, row: any) => any;
}

/**
 * 엑셀 생성 옵션
 */
export interface ExcelOptions {
  sheetName?: string;
  fileName: string;
  columns: ExcelColumn[];
  headerStyle?: Partial<ExcelJS.Style>;
  freezeHeader?: boolean;
}

/**
 * 멀티시트 엑셀 생성 옵션
 */
export interface MultiSheetExcelOptions {
  fileName: string;
  sheets: {
    sheetName: string;
    data: Record<string, any>[];
    columns: ExcelColumn[];
  }[];
  headerStyle?: Partial<ExcelJS.Style>;
  freezeHeader?: boolean;
}

/**
 * 공용 엑셀 다운로드 서비스
 * 다양한 도메인에서 재사용 가능한 엑셀 내보내기 기능 제공
 */
@Injectable()
export class ExcelService {
  private readonly logger = new Logger(ExcelService.name);

  /**
   * 데이터를 엑셀 파일로 변환하여 Response로 전송
   */
  async downloadExcel<T extends Record<string, any>>(
    res: Response,
    data: T[],
    options: ExcelOptions,
  ): Promise<void> {
    const {
      sheetName = 'Sheet1',
      fileName,
      columns,
      headerStyle,
      freezeHeader = true,
    } = options;

    this.logger.log(`엑셀 다운로드 시작 - 파일: ${fileName}, 데이터 수: ${data.length}`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // 컬럼 설정
    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
      style: col.style,
    }));

    // 헤더 스타일 적용
    const headerRow = worksheet.getRow(1);
    headerRow.font = headerStyle?.font || { bold: true };
    headerRow.fill = headerStyle?.fill || {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    headerRow.alignment = headerStyle?.alignment || { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // 데이터 추가 (formatter 적용)
    data.forEach((row) => {
      const formattedRow: Record<string, any> = {};
      columns.forEach((col) => {
        const value = row[col.key];
        formattedRow[col.key] = col.formatter ? col.formatter(value, row) : value;
      });
      worksheet.addRow(formattedRow);
    });

    // 헤더 고정
    if (freezeHeader) {
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    // 테두리 스타일 적용
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Response 헤더 설정
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}.xlsx`);

    // 엑셀 파일 전송
    await workbook.xlsx.write(res);

    this.logger.log(`엑셀 다운로드 완료 - 파일: ${fileName}`);
  }

  /**
   * 엑셀 파일을 Buffer로 생성 (이메일 첨부 등에 활용)
   */
  async generateExcelBuffer<T extends Record<string, any>>(
    data: T[],
    options: Omit<ExcelOptions, 'fileName'>,
  ): Promise<Buffer> {
    const { sheetName = 'Sheet1', columns, headerStyle, freezeHeader = true } = options;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // 컬럼 설정
    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
      style: col.style,
    }));

    // 헤더 스타일 적용
    const headerRow = worksheet.getRow(1);
    headerRow.font = headerStyle?.font || { bold: true };
    headerRow.fill = headerStyle?.fill || {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    headerRow.alignment = headerStyle?.alignment || { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    // 데이터 추가
    data.forEach((row) => {
      const formattedRow: Record<string, any> = {};
      columns.forEach((col) => {
        const value = row[col.key];
        formattedRow[col.key] = col.formatter ? col.formatter(value, row) : value;
      });
      worksheet.addRow(formattedRow);
    });

    // 헤더 고정
    if (freezeHeader) {
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    // 테두리 스타일 적용
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * 멀티시트 엑셀 다운로드
   */
  async downloadMultiSheetExcel(
    res: Response,
    options: MultiSheetExcelOptions,
  ): Promise<void> {
    const { fileName, sheets, headerStyle, freezeHeader = true } = options;

    this.logger.log(`멀티시트 엑셀 다운로드 시작 - 파일: ${fileName}, 시트 수: ${sheets.length}`);

    const workbook = new ExcelJS.Workbook();

    for (const sheet of sheets) {
      const worksheet = workbook.addWorksheet(sheet.sheetName);

      // 컬럼 설정
      worksheet.columns = sheet.columns.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width || 15,
        style: col.style,
      }));

      // 헤더 스타일 적용
      const headerRow = worksheet.getRow(1);
      headerRow.font = headerStyle?.font || { bold: true };
      headerRow.fill = headerStyle?.fill || {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
      headerRow.alignment = headerStyle?.alignment || { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 25;

      // 데이터 추가 (formatter 적용)
      sheet.data.forEach((row) => {
        const formattedRow: Record<string, any> = {};
        sheet.columns.forEach((col) => {
          const value = row[col.key];
          formattedRow[col.key] = col.formatter ? col.formatter(value, row) : value;
        });
        worksheet.addRow(formattedRow);
      });

      // 헤더 고정
      if (freezeHeader) {
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];
      }

      // 테두리 스타일 및 숫자 서식 적용
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
          // 숫자 셀에 컴마 서식 적용 (헤더 제외)
          if (rowNumber > 1 && typeof cell.value === 'number') {
            cell.numFmt = '#,##0';
          }
        });
      });
    }

    // Response 헤더 설정
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}.xlsx`);

    // 엑셀 파일 전송
    await workbook.xlsx.write(res);

    this.logger.log(`멀티시트 엑셀 다운로드 완료 - 파일: ${fileName}`);
  }
}
