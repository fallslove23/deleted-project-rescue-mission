import { AreaChart as RechartsAreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface AreaChartProps {
  data: Array<{
    name: string;
    [key: string]: string | number;
  }>;
  dataKeys: Array<{
    key: string;
    label: string;
    color?: string;
  }>;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  stacked?: boolean;
}

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))', 
  'hsl(var(--accent))',
  '#82ca9d',
  '#ffc658',
  '#ff7300'
];

export const AreaChart = ({ 
  data, 
  dataKeys,
  title, 
  xAxisLabel, 
  yAxisLabel,
  stacked = false
}: AreaChartProps) => {
  return (
    <div className="w-full h-full">
      {title && (
        <h3 className="text-center font-semibold mb-4 text-foreground">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(var(--muted-foreground) / 0.3)"
          />
          <XAxis 
            dataKey="name"
            tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
            axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            label={xAxisLabel ? { 
              value: xAxisLabel, 
              position: 'insideBottom', 
              offset: -5,
              style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
            } : undefined}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
            axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            label={yAxisLabel ? {
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
            } : undefined}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--card-foreground))'
            }}
          />
          <Legend 
            wrapperStyle={{ 
              fontSize: '12px',
              color: 'hsl(var(--foreground))'
            }}
          />
          {dataKeys.map((item, index) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              stackId={stacked ? "1" : undefined}
              stroke={item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              fill={item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              fillOpacity={0.6}
              name={item.label}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
};