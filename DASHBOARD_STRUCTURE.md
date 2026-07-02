# Edgevault Dashboard Structure - BETA Overhaul

## Dashboard Layout Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     EDGEVAULT DASHBOARD                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ OVERVIEW SECTION (Default Landing)                       │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐               │   │
│  │  │ Currency        │  │ Market          │               │   │
│  │  │ Strength        │  │ Intelligence    │               │   │
│  │  │ Widget          │  │ Summary         │               │   │
│  │  └─────────────────┘  └─────────────────┘               │   │
│  │                                                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐               │   │
│  │  │ Watchlist       │  │ Performance     │               │   │
│  │  │ Widget          │  │ Calendar        │               │   │
│  │  │ (Interactive)   │  │ (Enhanced)      │               │   │
│  │  └─────────────────┘  └─────────────────┘               │   │
│  │                                                            │   │
│  │  ┌──────────────────────────────────────┐               │   │
│  │  │ Dashboard Customizer                 │               │   │
│  │  │ (Toggle widget visibility)           │               │   │
│  │  └──────────────────────────────────────┘               │   │
│  │                                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ RISK MANAGEMENT SECTION (Tabbed Interface)              │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  [📊 Exposure Map] [⚙️ Dynamic Risk Engine]             │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  ┌──────────────────────────────────────┐               │   │
│  │  │ TAB 1: Exposure Map                  │               │   │
│  │  │ - Portfolio allocation calculator    │               │   │
│  │  │ - Risk exposure analysis             │               │   │
│  │  │ - Pair breakdown                     │               │   │
│  │  └──────────────────────────────────────┘               │   │
│  │                                                            │   │
│  │  ┌──────────────────────────────────────┐               │   │
│  │  │ TAB 2: Dynamic Risk Engine           │               │   │
│  │  │ - 4-style portfolio framework        │               │   │
│  │  │ - Auto lot sizing                    │               │   │
│  │  │ - Live P&L tracking                  │               │   │
│  │  │ - Trade log with statistics          │               │   │
│  │  │ - Alerts system                      │               │   │
│  │  └──────────────────────────────────────┘               │   │
│  │                                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ OTHER SECTIONS                                           │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ - Fundamentals (Currency Strength, COT, Watchlist)       │   │
│  │ - Performance (Trade analysis, statistics)               │   │
│  │ - Journal (Trade entries, analysis)                      │   │
│  │ - New Entry (Quick trade logging)                        │   │
│  │ - Connect Platform (MT5 integration)                     │   │
│  │ - Settings                                               │   │
│  │                                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Widget Interconnection Map

### Currency Strength Widget
- **Location**: Overview section
- **Data Source**: `useCurrencyStrength` hook
- **Updates**: Every 5 minutes
- **Interactions**: 
  - Click "Open" → Fundamentals section (Currency Strength tab)
  - Used by: Risk Engine for pair analysis

### Market Intelligence Summary Widget
- **Location**: Overview section
- **Data Sources**: `useCotData`, `useVolumeOiData` hooks
- **Updates**: Every 30-60 minutes
- **Interactions**:
  - Click "Details" → Fundamentals section (COT tab)
  - Informs Risk Engine positioning decisions

### Watchlist Widget (Interactive)
- **Location**: Overview section
- **Data Source**: Supabase watchlist + live prices
- **Updates**: Real-time
- **Interactions**:
  - Click pair → Fundamentals section (specific pair analysis)
  - Click "View All" → Fundamentals section (Watchlist tab)

### Performance Calendar Widget (Enhanced)
- **Location**: Overview section
- **Data Source**: Supabase trade_logs
- **Updates**: Real-time
- **Interactions**:
  - Click date → Journal section (specific date trades)
  - Click "Full View" → Performance section

### Risk Management Workspace (Tabbed)
- **Location**: Risk Management section
- **Tab 1 - Exposure Map**: 
  - Portfolio allocation calculator
  - Multi-entry zone planner
  - Exposure analysis
- **Tab 2 - Dynamic Risk Engine**:
  - 4-style portfolio framework (Scalp/Day/Swing/Position)
  - Auto lot sizing with multiple modes
  - Live P&L tracking
  - Trade log with statistics
  - Alerts system

## Data Flow & Consistency

### Currency Strength Flow
```
API (/api/currency-strength)
    ↓
useCurrencyStrength hook
    ↓
localStorage cache (5 min)
    ↓
CurrencyStrengthWidget (Dashboard)
CurrencyStrengthWidget (Fundamentals)
Risk Engine (pair analysis)
```

### COT Data Flow
```
API (/api/cot-data)
    ↓
useCotData hook
    ↓
localStorage cache (1 hour)
    ↓
MarketIntelligenceSummary (Dashboard)
Fundamentals COT tab
Risk Engine (positioning)
```

### Volume/OI Data Flow
```
API (/api/volume-oi)
    ↓
useVolumeOiData hook
    ↓
localStorage cache (30 min)
    ↓
MarketIntelligenceSummary (Dashboard)
Fundamentals Volume/OI tab
Risk Engine (confirmation)
```

## Navigation Paths

### From Overview to Risk Management
1. Click "Risk Management" in sidebar → Risk Management Workspace
2. Choose tab: "Exposure Map" or "Dynamic Risk Engine"

### From Risk Engine to Analysis
1. In Risk Engine, select a pair
2. Click "Open" or pair name
3. Navigate to Fundamentals → specific pair analysis

### From Dashboard to Detailed Views
1. **Currency Strength** → Click "Open" → Fundamentals (Currency Strength)
2. **Market Intelligence** → Click "Details" → Fundamentals (COT)
3. **Watchlist** → Click pair → Fundamentals (Pair Analysis)
4. **Performance Calendar** → Click date → Journal (Date Trades)

## Component Dependencies

```
Dashboard Page
├── Overview Section
│   ├── CurrencyStrengthWidget
│   │   └── useCurrencyStrength hook
│   ├── MarketIntelligenceSummary
│   │   ├── useCotData hook
│   │   └── useVolumeOiData hook
│   ├── WatchlistWidgetInteractive
│   │   └── Supabase watchlist data
│   └── PerformanceCalendarWidgetEnhanced
│       └── Supabase trade_logs data
│
├── Risk Management Section
│   └── RiskManagementWorkspaceEnhanced
│       ├── Tab: Exposure Map
│       │   └── RiskManagementWorkspace
│       └── Tab: Dynamic Risk Engine
│           └── DynamicRiskEngineWorkspace
│               ├── useCurrencyStrength hook
│               ├── Live price API
│               └── localStorage (positions, presets, log)
│
└── Other Sections
    ├── Fundamentals
    ├── Performance
    ├── Journal
    ├── New Entry
    └── Connect Platform
```

## Styling & Theme

All components follow the **dark terminal theme** with consistent color palette:

| Element | Color | Hex |
|---------|-------|-----|
| Primary Accent | Yellow | #facc15 |
| Success | Green | #4ade80 |
| Warning/Alert | Red | #f87171 |
| Info | Cyan | #22d3ee |
| Background | Black/Slate | #000000 / #0f172a |
| Border | Gray | #1e293b |
| Text Primary | White | #ffffff |
| Text Secondary | Gray | #9ca3af |

## Responsive Design

- **Desktop**: Full dashboard with all widgets visible
- **Tablet**: Stacked layout, widgets adapt to 1-2 columns
- **Mobile**: Single column, collapsible sections

## Performance Metrics

- **Initial Load**: ~2-3s (with caching)
- **Widget Update**: ~500ms (with cached data)
- **API Call**: ~1-2s (first time, then cached)
- **Cache Hit Rate**: ~95% (after initial load)

## Future Enhancements

1. Real-time WebSocket updates for currency strength
2. Advanced filtering in Watchlist widget
3. Custom alert notifications
4. Export functionality for trade logs
5. Advanced charting capabilities
6. Mobile app version
