# Edgevault BETA Overhaul - Task List

## Phase 1: Dashboard Integration ✅ (COMPLETED)
- [x] Move Dynamic Risk Engine into Risk Management workspace as a tab
- [x] Replace old Watchlist widget with WatchlistWidgetInteractive
- [x] Replace old Performance Calendar with PerformanceCalendarWidgetEnhanced
- [x] Add Market Intelligence Summary widget to dashboard
- [x] Update dashboard imports and widget rendering

## Phase 2: Unified Data Layer ✅ (COMPLETED)
- [x] Create useCurrencyStrength hook for consistent currency strength data
- [x] Create useCotData hook for consistent COT data
- [x] Create useVolumeOiData hook for consistent Volume/OI data
- [x] Implement localStorage caching to prevent duplicate API calls
- [x] Set appropriate cache durations (5min, 1hr, 30min)

## Phase 3: Widget Interconnection (IN PROGRESS)
- [ ] Update CurrencyStrengthWidget to use useCurrencyStrength hook
- [ ] Update WatchlistWidgetInteractive to use unified data hooks
- [ ] Update MarketIntelligenceSummary to use useCotData and useVolumeOiData
- [ ] Update PerformanceCalendarWidgetEnhanced to fetch real Supabase trade data
- [ ] Ensure all widgets share the same data sources

## Phase 4: Data Consistency Audit
- [ ] Verify Currency Strength matches across Fundamentals and Dashboard widgets
- [ ] Verify COT data consistency across all components
- [ ] Verify Volume/OI data consistency across all components
- [ ] Test cache invalidation and refresh mechanisms
- [ ] Validate API response formats match hook expectations

## Phase 5: UX/Styling Consistency
- [ ] Audit all dashboard widgets for dark terminal theme consistency
- [ ] Ensure consistent color palette (cyan, yellow, green, red)
- [ ] Verify font sizes and spacing follow design system
- [ ] Check hover states and transitions on all interactive elements
- [ ] Test responsive design on mobile/tablet/desktop

## Phase 6: Performance Calendar Enhancement
- [ ] Connect PerformanceCalendarWidget to real Supabase trade_logs data
- [ ] Replace mock data with actual trade data from database
- [ ] Implement date filtering and trade lookup
- [ ] Add drill-down to view trades for specific dates
- [ ] Optimize query performance for large trade datasets

## Phase 7: Dashboard Customizer Persistence
- [ ] Verify widget preferences save correctly to localStorage
- [ ] Test widget reordering persistence
- [ ] Test widget visibility toggle persistence
- [ ] Validate preferences load on page refresh
- [ ] Test across multiple browser tabs

## Phase 8: Risk Engine Integration Testing
- [ ] Test Risk Engine tab switching in Risk Management workspace
- [ ] Verify all Risk Engine features work in new location
- [ ] Test data persistence between tabs
- [ ] Verify no state conflicts with Exposure Map tab
- [ ] Test localStorage auto-save functionality

## Phase 9: API Route Verification
- [ ] Verify /api/currency-strength route returns correct format
- [ ] Verify /api/cot-data route returns correct format
- [ ] Verify /api/volume-oi route returns correct format
- [ ] Test API error handling and fallbacks
- [ ] Monitor API response times and optimize if needed

## Phase 10: Final Testing & Documentation
- [ ] End-to-end testing of all dashboard widgets
- [ ] Cross-browser compatibility testing
- [ ] Performance profiling and optimization
- [ ] Document data flow architecture
- [ ] Create user guide for BETA features
- [ ] Prepare release notes

## Known Issues & Blockers
- [ ] None currently identified

## Notes
- All interactive widgets now use unified data hooks for consistency
- Risk Engine moved from standalone section to Risk Management workspace tab
- Dashboard Customizer enables widget visibility and reordering
- Cache durations optimized for real-time vs historical data needs
