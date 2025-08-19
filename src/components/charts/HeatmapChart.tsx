import { ResponsiveContainer, Cell } from 'recharts';

interface HeatmapData {
  x: string;
  y: string;
  value: number;
  label?: string;
}

interface HeatmapChartProps {
  data: HeatmapData[];
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  colorScale?: [string, string]; // [minColor, maxColor]
}

export const HeatmapChart = ({ 
  data, 
  title, 
  xAxisLabel, 
  yAxisLabel,
  colorScale = ['hsl(var(--muted))', 'hsl(var(--primary))']
}: HeatmapChartProps) => {
  // 데이터에서 고유한 x, y 값들 추출
  const xValues = [...new Set(data.map(d => d.x))];
  const yValues = [...new Set(data.map(d => d.y))];
  
  // 최대/최소값 계산
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  
  // 색상 계산 함수
  const getColor = (value: number) => {
    if (maxValue === minValue) return colorScale[0];
    const intensity = (value - minValue) / (maxValue - minValue);
    
    // HSL 색상 보간
    const minHSL = parseHSL(colorScale[0]);
    const maxHSL = parseHSL(colorScale[1]);
    
    const h = minHSL.h + (maxHSL.h - minHSL.h) * intensity;
    const s = minHSL.s + (maxHSL.s - minHSL.s) * intensity;
    const l = minHSL.l + (maxHSL.l - minHSL.l) * intensity;
    
    return `hsl(${h}, ${s}%, ${l}%)`;
  };
  
  // HSL 파싱 함수
  const parseHSL = (hslString: string) => {
    const match = hslString.match(/hsl\(var\(--(\w+)\)\)/);
    if (match) {
      // CSS 변수 기반인 경우 기본값 사용
      return { h: 210, s: 50, l: 50 };
    }
    
    const values = hslString.match(/\d+/g);
    if (values && values.length >= 3) {
      return {
        h: parseInt(values[0]),
        s: parseInt(values[1]),
        l: parseInt(values[2])
      };
    }
    return { h: 210, s: 50, l: 50 };
  };
  
  // 셀 크기 계산
  const cellWidth = 100 / xValues.length;
  const cellHeight = 100 / yValues.length;

  return (
    <div className="w-full h-full">
      {title && (
        <h3 className="text-center font-semibold mb-4 text-foreground">{title}</h3>
      )}
      
      <div className="relative w-full h-full min-h-[300px]">
        {/* Y축 라벨 */}
        {yAxisLabel && (
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -rotate-90">
            <span className="text-sm font-medium text-muted-foreground">{yAxisLabel}</span>
          </div>
        )}
        
        {/* 메인 차트 영역 */}
        <div className="ml-8 mb-8 h-full">
          <div className="relative w-full h-full">
            {/* Y축 값들 */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between pr-2">
              {yValues.map(y => (
                <div key={y} className="text-xs text-muted-foreground flex items-center h-full">
                  {y}
                </div>
              ))}
            </div>
            
            {/* 히트맵 그리드 */}
            <div className="ml-12 h-full">
              <svg width="100%" height="80%" viewBox="0 0 100 100" className="border border-border rounded">
                {data.map((item, index) => {
                  const xIndex = xValues.indexOf(item.x);
                  const yIndex = yValues.indexOf(item.y);
                  
                  return (
                    <g key={index}>
                      <rect
                        x={xIndex * cellWidth}
                        y={yIndex * cellHeight}
                        width={cellWidth}
                        height={cellHeight}
                        fill={getColor(item.value)}
                        stroke="white"
                        strokeWidth="0.5"
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                      {/* 값 표시 */}
                      <text
                        x={xIndex * cellWidth + cellWidth / 2}
                        y={yIndex * cellHeight + cellHeight / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="3"
                        fill="white"
                        fontWeight="bold"
                      >
                        {item.label || item.value}
                      </text>
                    </g>
                  );
                })}
              </svg>
              
              {/* X축 값들 */}
              <div className="flex justify-between mt-2">
                {xValues.map(x => (
                  <div key={x} className="text-xs text-muted-foreground text-center flex-1">
                    {x}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* X축 라벨 */}
        {xAxisLabel && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
            <span className="text-sm font-medium text-muted-foreground">{xAxisLabel}</span>
          </div>
        )}
        
        {/* 범례 */}
        <div className="absolute top-0 right-0 flex flex-col items-center">
          <div className="text-xs text-muted-foreground mb-1">값</div>
          <div className="flex flex-col items-center">
            <div className="text-xs text-muted-foreground">{maxValue}</div>
            <div 
              className="w-4 h-12 rounded"
              style={{
                background: `linear-gradient(to top, ${colorScale[0]}, ${colorScale[1]})`
              }}
            />
            <div className="text-xs text-muted-foreground">{minValue}</div>
          </div>
        </div>
      </div>
    </div>
  );
};