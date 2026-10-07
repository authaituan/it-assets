import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { KpiSummary, ItWarnings, UpgradeRequired, RecentActivity, EmailStats } from './dashboard/SystemWidgets';
import { ChartWidget } from './dashboard/ChartWidget';

const SIZE_CLASSES = {
  S: 'col-span-12 sm:col-span-6 lg:col-span-3',
  M: 'col-span-12 sm:col-span-6 lg:col-span-4',
  L: 'col-span-12 sm:col-span-6 lg:col-span-6',
  XL: 'col-span-12 lg:col-span-8',
  FULL: 'col-span-12',
};

function getWidgetMinHeight(widget) {
  if (widget.kind !== 'CHART') return '';
  const largeSizes = ['L', 'XL', 'FULL'];
  const tallCharts = ['BAR', 'BAR_H', 'LINE', 'DONUT'];
  if (tallCharts.includes(widget.chart_type) && largeSizes.includes(widget.size)) {
    return 'min-h-[360px]';
  }
  return 'min-h-[300px]';
}

export default function DashboardView({ onSelectCommune, onNavigateToEmails }) {
  const [stats, setStats] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [widgetsData, setWidgetsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDashboard = () => {
    setLoading(true);
    setError(false);
    
    Promise.all([
      apiFetch('/api/dashboard/stats').then(r => {
        if (!r.ok) throw new Error("Stats API Error");
        return r.json();
      }),
      apiFetch('/api/dashboard/widgets').then(r => {
        if (!r.ok) throw new Error("Widgets API Error");
        return r.json();
      }),
      apiFetch('/api/dashboard/widgets-data').then(r => {
        if (!r.ok) throw new Error("Widgets Data API Error");
        return r.json();
      })
    ])
    .then(([statsData, widgetsRes, widgetsDataRes]) => {
      setStats(statsData);
      // Filter out hidden widgets
      const visibleWidgets = (widgetsRes.items || []).filter(w => w.visible === true);
      setWidgets(visibleWidgets);
      setWidgetsData(widgetsDataRes);
      setLoading(false);
    })
    .catch(err => {
      console.error("Error loading dashboard:", err);
      setError(true);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && (!stats || !widgets.length)) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[600px] gap-3">
        <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-medium">Đang tải số liệu Dashboard...</p>
      </div>
    );
  }

  if (error && (!stats || !widgets.length)) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[600px] gap-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-500">
          <AlertCircle className="w-8 h-8" />
        </div>
        <p className="text-sm text-gray-600 font-medium">Không thể tải dữ liệu Dashboard.</p>
        <button onClick={fetchDashboard} className="flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity">
          <RefreshCw className="w-4 h-4" /> Thử lại
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const renderWidget = (widget) => {
    const sizeClass = SIZE_CLASSES[widget.size] || SIZE_CLASSES['M'];
    const minHeightClass = getWidgetMinHeight(widget);
    
    // For KPI_SUMMARY, it's already a grid itself, no need to force a height if it's natural.
    // However, flex items-stretch on the grid will make items same height, which is good.

    if (widget.kind === 'SYSTEM') {
      let SystemComponent = null;
      switch (widget.system_key) {
        case 'KPI_SUMMARY':
          SystemComponent = <KpiSummary title={widget.title} stats={stats} />;
          break;
        case 'IT_WARNINGS':
          SystemComponent = <ItWarnings title={widget.title} stats={stats} />;
          break;
        case 'UPGRADE':
          SystemComponent = <UpgradeRequired title={widget.title} stats={stats} />;
          break;
        case 'RECENT_ACTIVITY':
          SystemComponent = <RecentActivity title={widget.title} stats={stats} />;
          break;
        case 'EMAIL_STATS':
          SystemComponent = <EmailStats title={widget.title} stats={stats} onNavigateToEmails={onNavigateToEmails} />;
          break;
        default:
          return null; // Skip unknown system widgets
      }

      return (
        <div key={widget.id} className={`${sizeClass} ${minHeightClass}`}>
          {SystemComponent}
        </div>
      );
    }

    if (widget.kind === 'CHART') {
      const wData = widgetsData && widgetsData[widget.id];
      return (
        <div key={widget.id} className={`${sizeClass} ${minHeightClass}`}>
          <ChartWidget widget={widget} data={wData} />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-6 font-sans" style={{ fontFamily: 'Inter, sans-serif' }}>
      {loading && (
        <div className="fixed top-24 right-6 bg-white shadow-lg rounded-full p-2 z-50 animate-pulse">
          <RefreshCw className="w-5 h-5 text-[#F97316] animate-spin" />
        </div>
      )}
      
      {widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400 bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)]">
          <div className="text-lg font-medium">Dashboard chưa có ô nào hiển thị</div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6 items-stretch">
          {widgets.map(renderWidget)}
        </div>
      )}
    </div>
  );
}
