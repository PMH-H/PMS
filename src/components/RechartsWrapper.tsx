
import React, { Suspense } from 'react';

// Lazy load Recharts components
const BarChartLazy = React.lazy(() => import('recharts').then(module => ({ default: module.BarChart })));
const BarLazy = React.lazy(() => import('recharts').then(module => ({ default: module.Bar })));
const LineChartLazy = React.lazy(() => import('recharts').then(module => ({ default: module.LineChart })));
const LineLazy = React.lazy(() => import('recharts').then(module => ({ default: module.Line })));
const AreaChartLazy = React.lazy(() => import('recharts').then(module => ({ default: module.AreaChart })));
const AreaLazy = React.lazy(() => import('recharts').then(module => ({ default: module.Area })));
const PieChartLazy = React.lazy(() => import('recharts').then(module => ({ default: module.PieChart })));
const PieLazy = React.lazy(() => import('recharts').then(module => ({ default: module.Pie })));
const XAxisLazy = React.lazy(() => import('recharts').then(module => ({ default: module.XAxis })));
const YAxisLazy = React.lazy(() => import('recharts').then(module => ({ default: module.YAxis })));
const CartesianGridLazy = React.lazy(() => import('recharts').then(module => ({ default: module.CartesianGrid })));
const TooltipLazy = React.lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const LegendLazy = React.lazy(() => import('recharts').then(module => ({ default: module.Legend })));
const ResponsiveContainerLazy = React.lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));
const CellLazy = React.lazy(() => import('recharts').then(module => ({ default: module.Cell })));
const ComposedChartLazy = React.lazy(() => import('recharts').then(module => ({ default: module.ComposedChart })));

// Loading placeholder
const ChartLoader = () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
        <div className="text-gray-400 text-sm">Loading Chart...</div>
    </div>
);

export const BarChart = (props: any) => (
    <Suspense fallback={<ChartLoader />}>
        <BarChartLazy {...props} />
    </Suspense>
);

export const Bar = (props: any) => (
    <Suspense fallback={null}>
        <BarLazy {...props} />
    </Suspense>
);

export const LineChart = (props: any) => (
    <Suspense fallback={<ChartLoader />}>
        <LineChartLazy {...props} />
    </Suspense>
);

export const Line = (props: any) => (
    <Suspense fallback={null}>
        <LineLazy {...props} />
    </Suspense>
);

export const AreaChart = (props: any) => (
    <Suspense fallback={<ChartLoader />}>
        <AreaChartLazy {...props} />
    </Suspense>
);

export const Area = (props: any) => (
    <Suspense fallback={null}>
        <AreaLazy {...props} />
    </Suspense>
);

export const PieChart = (props: any) => (
    <Suspense fallback={<ChartLoader />}>
        <PieChartLazy {...props} />
    </Suspense>
);

export const Pie = (props: any) => (
    <Suspense fallback={null}>
        <PieLazy {...props} />
    </Suspense>
);

export const XAxis = (props: any) => (
    <Suspense fallback={null}>
        <XAxisLazy {...props} />
    </Suspense>
);

export const YAxis = (props: any) => (
    <Suspense fallback={null}>
        <YAxisLazy {...props} />
    </Suspense>
);

export const CartesianGrid = (props: any) => (
    <Suspense fallback={null}>
        <CartesianGridLazy {...props} />
    </Suspense>
);

export const Tooltip = (props: any) => (
    <Suspense fallback={null}>
        <TooltipLazy {...props} />
    </Suspense>
);

export const Legend = (props: any) => (
    <Suspense fallback={null}>
        <LegendLazy {...props} />
    </Suspense>
);

export const ResponsiveContainer = (props: any) => (
    <Suspense fallback={<ChartLoader />}>
        <ResponsiveContainerLazy {...props} />
    </Suspense>
);

export const Cell = (props: any) => (
    <Suspense fallback={null}>
        <CellLazy {...props} />
    </Suspense>
);

export const ComposedChart = (props: any) => (
    <Suspense fallback={<ChartLoader />}>
        <ComposedChartLazy {...props} />
    </Suspense>
);
