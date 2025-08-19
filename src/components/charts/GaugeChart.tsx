import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface GaugeChartProps {
  value: number; // 0-100 사이의 값
  maxValue?: number;
  title?: string;
  subtitle?: string;
  size?: number;
  thickness?: number;
  colors?: {
    background?: string;
    fill?: string;
    text?: string;
  };
}

export const GaugeChart = ({ 
  value, 
  maxValue = 100,
  title, 
  subtitle,
  size = 200,
  thickness = 20,
  colors = {
    background: 'hsl(var(--muted))',
    fill: 'hsl(var(--primary))',
    text: 'hsl(var(--foreground))'
  }
}: GaugeChartProps) => {
  const normalizedValue = Math.min(Math.max(value, 0), maxValue);
  const percentage = (normalizedValue / maxValue) * 100;
  
  // 게이지 데이터 (180도 반원)
  const data = [
    { name: 'filled', value: percentage, color: colors.fill },
    { name: 'empty', value: 100 - percentage, color: colors.background }
  ];

  const renderLabel = () => null; // 라벨 숨김

  return (
    <div className="flex flex-col items-center">
      {title && (
        <h3 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
          {title}
        </h3>
      )}
      
      <div className="relative" style={{ width: size, height: size / 2 + 20 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="90%" // 하단에 중심점 위치
              startAngle={180} // 왼쪽부터 시작
              endAngle={0} // 오른쪽에서 끝
              innerRadius={size / 2 - thickness}
              outerRadius={size / 2}
              dataKey="value"
              labelLine={false}
              label={renderLabel}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {/* 중앙 값 표시 */}
        <div 
          className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center"
          style={{ color: colors.text }}
        >
          <div className="text-2xl font-bold">
            {normalizedValue.toFixed(1)}
          </div>
          {subtitle && (
            <div className="text-sm text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        
        {/* 눈금 표시 */}
        <div className="absolute inset-0 pointer-events-none">
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = 180 - (tick / 100) * 180; // 180도에서 0도까지
            const radian = (angle * Math.PI) / 180;
            const innerRadius = size / 2 - thickness - 5;
            const outerRadius = size / 2 - thickness;
            
            const x1 = size / 2 + innerRadius * Math.cos(radian);
            const y1 = size / 2 + innerRadius * Math.sin(radian);
            const x2 = size / 2 + outerRadius * Math.cos(radian);
            const y2 = size / 2 + outerRadius * Math.sin(radian);
            
            return (
              <div key={tick}>
                <svg 
                  className="absolute inset-0"
                  width={size} 
                  height={size / 2 + 20}
                >
                  <line
                    x1={x1}
                    y1={y1 + 10}
                    x2={x2}
                    y2={y2 + 10}
                    stroke={colors.text}
                    strokeWidth="1"
                    opacity="0.5"
                  />
                </svg>
                
                {/* 눈금 라벨 */}
                <div
                  className="absolute text-xs"
                  style={{
                    left: x1 - 8,
                    top: y1 + 5,
                    color: colors.text,
                    opacity: 0.7
                  }}
                >
                  {(tick * maxValue / 100).toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};