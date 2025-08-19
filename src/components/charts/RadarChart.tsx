import { Radar, RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface RadarChartProps {
  data: Array<{
    subject: string;
    value: number;
    fullMark?: number;
  }>;
  title?: string;
  colors?: {
    fill?: string;
    stroke?: string;
  };
}

export const RadarChart = ({ 
  data, 
  title,
  colors = {
    fill: 'hsl(var(--primary) / 0.3)',
    stroke: 'hsl(var(--primary))'
  }
}: RadarChartProps) => {
  return (
    <div className="w-full h-full">
      {title && (
        <h3 className="text-center font-semibold mb-4 text-foreground">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data} margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
          <PolarGrid 
            stroke="hsl(var(--muted-foreground) / 0.3)"
          />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ 
              fontSize: 12, 
              fill: 'hsl(var(--foreground))'
            }}
          />
          <PolarRadiusAxis 
            angle={90}
            domain={[0, 10]}
            tick={{ 
              fontSize: 10, 
              fill: 'hsl(var(--muted-foreground))'
            }}
          />
          <Radar
            name="점수"
            dataKey="value"
            stroke={colors.stroke}
            fill={colors.fill}
            fillOpacity={0.6}
            strokeWidth={2}
          />
          <Tooltip 
            formatter={(value: number) => [`${value}점`, '점수']}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--card-foreground))'
            }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
};