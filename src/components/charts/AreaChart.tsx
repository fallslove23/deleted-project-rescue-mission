import { ReactNode, useMemo } from 'react';
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { ChartEmptyState } from './ChartEmptyState';

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
  emptyState?: ReactNode;
}

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-purple-light))'
];

export const AreaChart = ({
  data,
  dataKeys,
  title,
  xAxisLabel,
  yAxisLabel,
  stacked = false,
  emptyState
}: AreaChartProps) => {
  const hasData = useMemo(() => {
    if (!data || data.length === 0) return false;

    return dataKeys.some(item =>
      data.some(row => {
        const value = row[item.key];
        return typeof value === 'number' && !isNaN(value) && value !== 0;
      })
    );
  }, [data, dataKeys]);

  return (
    <div className="h-full w-full">
      {title && (
        <h3 className="mb-4 text-center font-semibold text-foreground">{title}</h3>
      )}
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <RechartsAreaChart
            data={data}
            margin={{
              top: 10,
              right: 30,
              left: 20,
              bottom: 5
            }}
          >
            <defs>
              {dataKeys.map((item, index) => (
                <linearGradient key={`gradient${index}`} id={`gradient${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="100%"
                    stopColor={item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-1) / 0.2)" strokeWidth={1} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              label={
                xAxisLabel
                  ? {
                      value: xAxisLabel,
                      position: 'insideBottom',
                      offset: -5,
                      style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                    }
                  : undefined
              }
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: 'insideLeft',
                      style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' }
                    }
                  : undefined
              }
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
                stackId={stacked ? '1' : undefined}
                stroke={item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                fill={`url(#gradient${index})`}
                fillOpacity={0.8}
                strokeWidth={3}
                name={item.label}
                dot={{ r: 4, strokeWidth: 2, stroke: 'white' }}
              />
            ))}
          </RechartsAreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-64 w-full items-center justify-center">
          {emptyState ?? (
            <ChartEmptyState description="데이터가 없어 영역 차트를 표시할 수 없습니다. 조건을 변경하거나 데이터를 수집한 후 다시 시도하세요." />
          )}
        </div>
      )}
    </div>
  );
};
