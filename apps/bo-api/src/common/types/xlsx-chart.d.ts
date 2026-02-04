declare module 'xlsx-chart' {
  interface ChartOptions {
    file?: string;
    chart: 'column' | 'bar' | 'line' | 'area';
    titles: string[];
    fields: string[];
    data: Record<string, Record<string, number>>;
    templatePath?: string;
  }

  interface MultiChartOptions {
    file?: string;
    charts: ChartOptions[];
  }

  class XLSXChart {
    writeFile(opts: ChartOptions | MultiChartOptions, callback: (err: Error | null) => void): void;
    generate(opts: ChartOptions | MultiChartOptions, callback: (err: Error | null, data: Buffer) => void): void;
  }

  export = XLSXChart;
}
