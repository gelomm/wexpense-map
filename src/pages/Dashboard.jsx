import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import {
  FaMapMarkerAlt,
  FaPlus,
  FaStar,
  FaMoneyBillWave,
  FaRedo,
  FaHashtag,
  FaThumbsUp,
  FaQuestionCircle,
  FaList,
  FaTh,
  FaFire,
  FaRegLightbulb,
} from 'react-icons/fa';
import ExpenseForm from '../components/ExpenseForm';
import { useAuth } from '../contexts/AuthContext';
import { useMyExpenses } from '../hooks/useMyExpenses';
import toast from 'react-hot-toast';

const CHART_COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'];
const TAG_COLORS = {
  will_go_back: '#10b981',
  good: '#6366f1',
  one_time_only: '#a1a1aa',
  what_the_hell: '#f43f5e',
};

const tagLabels = {
  will_go_back: 'Will go back',
  one_time_only: 'One time only',
  good: 'Good',
  what_the_hell: 'What the hell?',
};

const tagIcons = {
  will_go_back: <FaRedo />,
  one_time_only: <FaHashtag />,
  good: <FaThumbsUp />,
  what_the_hell: <FaQuestionCircle />,
};

export default function Dashboard() {
  const { profile } = useAuth();
  const currency = profile?.currency || '₱';
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [flippedCardId, setFlippedCardId] = useState(null);
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [timeRange, setTimeRange] = useState('month');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboardView') || 'grid');
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [insightIndex, setInsightIndex] = useState(0);
  const navigate = useNavigate();

  // Your own expenses only – not the group
  const expenses = useMyExpenses();

  useEffect(() => {
    localStorage.setItem('dashboardView', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (expenses.length === 0) return;
    const interval = setInterval(() => {
      setInsightIndex((prev) => (prev + 1) % 4);
    }, 8000);
    return () => clearInterval(interval);
  }, [expenses]);

  const handleCardClick = (expense) => {
    setFlippedCardId(expense.id);
    setTimeout(() => {
      setEditExpense(expense);
      setShowForm(true);
      setFlippedCardId(null);
    }, 400);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditExpense(null);
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const todayExpenses = expenses.filter(e => e.created_at.startsWith(todayStr));
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const todayCount = todayExpenses.length;

  const periodTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const tagCounts = expenses.reduce((acc, e) => {
    acc[e.location_tag] = (acc[e.location_tag] || 0) + 1;
    return acc;
  }, {});

  const tagTotals = expenses.reduce((acc, e) => {
    acc[e.location_tag] = (acc[e.location_tag] || 0) + e.amount;
    return acc;
  }, {});
  const tagChartData = Object.entries(tagTotals).map(([tag, value]) => ({
    name: tagLabels[tag] || tag,
    value,
    color: TAG_COLORS[tag] || '#6366f1',
  }));

  const locationTotals = expenses.reduce((acc, e) => {
    const name = e.short_location || e.location_name || 'Unknown';
    acc[name] = (acc[name] || 0) + e.amount;
    return acc;
  }, {});
  const chartData = Object.entries(locationTotals).map(([name, value]) => ({ name, value }));

  const ratingMap = expenses.reduce((acc, e) => {
    const name = e.short_location || e.location_name || 'Unknown';
    if (!acc[name]) acc[name] = { total: 0, count: 0 };
    acc[name].total += e.star_rating || 0;
    acc[name].count++;
    return acc;
  }, {});
  const leaderboard = Object.entries(ratingMap)
    .map(([name, { total, count }]) => ({ name, avg: total / count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  const mostExpensiveLocations = Object.entries(locationTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, total]) => ({ name, total }));

  const biggestSplurge = expenses.length > 0
    ? expenses.reduce((max, e) => (e.amount > max.amount ? e : max), expenses[0])
    : null;

  const computeStreak = () => {
    if (expenses.length === 0) return 0;
    const dates = [...new Set(expenses.map(e => e.created_at.split('T')[0]))].sort().reverse();
    let count = 0;
    const today = new Date();
    for (const date of dates) {
      const expected = new Date(today);
      expected.setDate(today.getDate() - count);
      const expectedStr = expected.toISOString().split('T')[0];
      if (date === expectedStr) {
        count++;
      } else if (date === todayStr && count === 0) {
        count = 1;
      } else {
        break;
      }
    }
    return count;
  };

  const streak = computeStreak();

  const filteredExpenses = activeTagFilter
    ? expenses.filter(e => e.location_tag === activeTagFilter)
    : expenses;

  const insights = [];
  if (leaderboard.length > 0) {
    insights.push(`Top rated: ${leaderboard[0].name} ⭐${leaderboard[0].avg.toFixed(1)}`);
  }
  if (mostExpensiveLocations.length > 0) {
    insights.push(`You spend most in ${mostExpensiveLocations[0].name}`);
  }
  if (expenses.length > 0) {
    const avgRating = (expenses.reduce((s, e) => s + e.star_rating, 0) / expenses.length).toFixed(1);
    insights.push(`Average rating this period: ⭐${avgRating}`);
  }
  if (streak > 1) {
    insights.push(`You've logged expenses ${streak} days in a row! 🔥`);
  }
  if (insights.length === 0) {
    insights.push("Log your first expense to see insights!");
  }

  const getPeriodLabel = () => {
    if (timeRange === 'week') return 'this week';
    if (timeRange === 'month') return 'this month';
    return 'this year';
  };

  return (
    <div className="relative space-y-6 p-8 pb-10 max-w-[1400px] mx-auto">
      {/* Top bar: time range + add expense */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex bg-white border border-zinc-200 rounded-full p-1">
            {['week', 'month', 'year'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <span className="text-zinc-400 text-sm">{getPeriodLabel()}</span>
        </div>

        <button
          onClick={() => { setEditExpense(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <FaPlus size={12} /> Add Expense
        </button>
      </div>

      {/* Today's Tab, Streak, Insight */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Today's Tab</h2>
          <p className="text-3xl font-semibold text-zinc-900 mt-2 tabular-nums">{currency}{todayTotal.toFixed(2)}</p>
          <p className="text-xs text-zinc-400 mt-1">{todayCount} expense{todayCount !== 1 ? 's' : ''} today</p>
        </div>

        {streak > 1 && (
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex items-center gap-4">
            <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FaFire className="text-orange-500" size={18} />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Spending Streak</p>
              <p className="text-2xl font-semibold text-zinc-900 mt-0.5">{streak} days</p>
            </div>
          </div>
        )}

        {insights.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex items-start gap-4">
            <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <FaRegLightbulb className="text-indigo-500" size={16} />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Insight</p>
              <p className="text-sm text-zinc-700 mt-1.5 leading-relaxed">
                {insights[insightIndex % insights.length]}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Summary: Period total + Biggest Splurge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            {getPeriodLabel().replace('this ', '')} expenses
          </h3>
          <p className="text-3xl font-semibold text-zinc-900 mt-2 tabular-nums">{currency}{periodTotal.toFixed(2)}</p>
          <p className="text-xs text-zinc-400 mt-1">Total {getPeriodLabel()}</p>
        </div>
        {biggestSplurge && (
          <div className="bg-white p-5 rounded-2xl border border-zinc-200">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-2">
              <FaMoneyBillWave className="text-zinc-400" size={12} /> Biggest Splurge {getPeriodLabel()}
            </p>
            <p className="text-2xl font-semibold text-zinc-900 mt-2 tabular-nums">
              {currency}{biggestSplurge.amount}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              @ {biggestSplurge.title || biggestSplurge.caption || 'Expense'}
            </p>
          </div>
        )}
      </div>

      {/* Tags Section */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">Location tags</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(tagCounts).map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
              className={`bg-white p-4 rounded-xl border text-left transition-all cursor-pointer ${
                activeTagFilter === tag
                  ? 'border-zinc-900 ring-1 ring-zinc-900'
                  : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center mb-2 text-xs"
                style={{ backgroundColor: `${TAG_COLORS[tag]}1A`, color: TAG_COLORS[tag] }}
              >
                {tagIcons[tag]}
              </div>
              <p className="text-xs font-medium text-zinc-500">{tagLabels[tag]}</p>
              <p className="text-xl font-semibold text-zinc-900">{count}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      {(chartData.length > 0 || tagChartData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {chartData.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-zinc-200">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                <FaMoneyBillWave className="text-zinc-400" size={13} /> Expense per location
              </h3>
              <div className="flex justify-center">
                <PieChart width={280} height={260}>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    paddingAngle={2}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </div>
            </div>
          )}

          {tagChartData.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-zinc-200">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                <FaHashtag className="text-zinc-400" size={13} /> Expense by tag
              </h3>
              <div className="flex justify-center">
                <PieChart width={280} height={260}>
                  <Pie
                    data={tagChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    paddingAngle={2}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {tagChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {(leaderboard.length > 0 || mostExpensiveLocations.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leaderboard.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-zinc-200">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                <FaStar className="text-amber-400" size={13} /> Top rated locations
              </h3>
              <ul className="divide-y divide-zinc-100">
                {leaderboard.map((loc, idx) => (
                  <li key={loc.name} className="flex justify-between items-center py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-zinc-400 w-4">{idx + 1}</span>
                      <span className="text-sm text-zinc-800 font-medium truncate max-w-[160px]">{loc.name}</span>
                    </div>
                    <span className="text-sm text-zinc-500 font-medium tabular-nums">{loc.avg.toFixed(1)} ★</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mostExpensiveLocations.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-zinc-200">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                <FaMoneyBillWave className="text-zinc-400" size={13} /> Top spending locations
              </h3>
              <ul className="divide-y divide-zinc-100">
                {mostExpensiveLocations.map((loc, idx) => (
                  <li key={loc.name} className="flex justify-between items-center py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-zinc-400 w-4">{idx + 1}</span>
                      <span className="text-sm text-zinc-800 font-medium truncate max-w-[160px]">{loc.name}</span>
                    </div>
                    <span className="text-sm text-zinc-500 font-medium tabular-nums">{currency}{loc.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Expense Cards Section with Grid/List Toggle */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-semibold text-zinc-900">Recent expenses</h3>
          <div className="flex bg-white border border-zinc-200 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700'}`}
            >
              <FaTh size={12} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-700'}`}
            >
              <FaList size={12} />
            </button>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-zinc-200 text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto mb-4 text-zinc-400">
              <FaMoneyBillWave size={18} />
            </div>
            <h4 className="text-sm font-semibold text-zinc-900">No expenses yet</h4>
            <p className="text-sm text-zinc-400 mt-1">
              {activeTagFilter
                ? `No "${tagLabels[activeTagFilter]}" expenses ${getPeriodLabel()}.`
                : 'Your wallet is safe... for now.'}
            </p>
            <button
              onClick={() => { setEditExpense(null); setShowForm(true); }}
              className="mt-4 inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <FaPlus size={12} /> Add your first expense
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredExpenses.slice(0, 12).map((exp) => (
              <div
                key={exp.id}
                className={`cursor-pointer bg-white border border-zinc-200 rounded-2xl overflow-hidden transition-all duration-150 hover:border-zinc-300 hover:shadow-sm ${
                  flippedCardId === exp.id ? 'scale-[0.97] opacity-70' : ''
                }`}
                onClick={() => handleCardClick(exp)}
              >
                <div className="w-full h-32 bg-zinc-100">
                  {exp.photo_url ? (
                    <img src={exp.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-semibold text-zinc-900 truncate">{exp.title || exp.caption || 'Expense'}</h4>
                  </div>
                  <p className="text-lg font-semibold text-zinc-900 mt-1 tabular-nums">{currency}{exp.amount}</p>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-xs text-zinc-400 truncate max-w-[100px]">{exp.short_location || exp.location_name}</span>
                    <span className="text-xs text-amber-500">{'★'.repeat(exp.star_rating)}<span className="text-zinc-200">{'★'.repeat(5 - exp.star_rating)}</span></span>
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-zinc-100">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${TAG_COLORS[exp.location_tag]}1A`, color: TAG_COLORS[exp.location_tag] }}
                    >
                      {tagLabels[exp.location_tag] || exp.location_tag}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (exp.latitude && exp.longitude) navigate(`/map?lat=${exp.latitude}&lng=${exp.longitude}`);
                      }}
                      className="text-zinc-400 hover:text-zinc-700 transition-colors"
                      title="View on map"
                    >
                      <FaMapMarkerAlt size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100 overflow-hidden">
            {filteredExpenses.slice(0, 20).map((exp) => (
              <div
                key={exp.id}
                className={`cursor-pointer flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 ${
                  flippedCardId === exp.id ? 'opacity-60' : ''
                }`}
                onClick={() => handleCardClick(exp)}
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0">
                  {exp.photo_url ? (
                    <img src={exp.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <h4 className="text-sm font-medium text-zinc-900 truncate">{exp.title || exp.caption || 'Expense'}</h4>
                    <span className="text-sm font-semibold text-zinc-900 tabular-nums flex-shrink-0">{currency}{exp.amount}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-zinc-400 mt-0.5">
                    <span>{exp.short_location || exp.location_name}</span>
                    <span className="text-amber-500">★ {exp.star_rating}</span>
                    <span>{tagLabels[exp.location_tag] || exp.location_tag}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (exp.latitude && exp.longitude) navigate(`/map?lat=${exp.latitude}&lng=${exp.longitude}`);
                  }}
                  className="text-zinc-400 hover:text-zinc-700 transition-colors flex-shrink-0"
                  title="View on map"
                >
                  <FaMapMarkerAlt size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ExpenseForm onClose={handleCloseForm} expense={editExpense} />
      )}
    </div>
  );
}