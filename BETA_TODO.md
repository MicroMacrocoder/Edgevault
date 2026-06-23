# EDGEVAULT BETA OVERHAUL TODO

## Phase 1: Data Consistency (COMPLETED)
- [x] Identify data mismatch between widgets and sections
- [x] Plan unified data layer

## Phase 2: Interactive & Customizable Widgets
- [ ] Fix DashboardCustomizer component (drag/drop, proper toggle)
- [ ] Make Currency Strength widget clickable → navigates to Fundamentals
- [ ] Make Watchlist widget clickable → navigates to pairs
- [ ] Make COT widget clickable → navigates to COT Analysis
- [ ] Make News widget clickable → navigates to Calendar
- [ ] Persist widget preferences to localStorage properly
- [ ] Test all widget interactions

## Phase 3: Market Intelligence Summary Widget
- [ ] Create MarketIntelligenceSummary component
- [ ] Combine COT + Volume + OI data
- [ ] Generate narrative about commercial hedging program
- [ ] Add to dashboard as widget
- [ ] Make it clickable to full section

## Phase 4: Trade Calendar Connected to Trade Log
- [ ] Query actual trades from Supabase
- [ ] Highlight trade days in calendar
- [ ] Show daily P&L ($ and %)
- [ ] Color code: green (win), red (loss)
- [ ] Make calendar interactive (click day to see trades)

## Phase 5: Move Risk Engine into Risk Management
- [ ] Create DynamicRiskEngineWorkspace component
- [ ] Add as tab in RiskManagementWorkspace
- [ ] Remove from sidebar
- [ ] Update navigation

## Phase 6: Unified Data Layer
- [ ] Create hooks: useCurrencyStrength, useCOTData, useVolumeOI, useTradeLog
- [ ] Ensure all sections pull from same source
- [ ] Sync data across widgets and sections
- [ ] Add real-time updates

## Phase 7: UX/Styling Audit & Fixes
- [ ] Check all widget styling consistency
- [ ] Fix responsive design issues
- [ ] Improve accessibility
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test on mobile

## Phase 8: Testing & Deployment
- [ ] Test all features end-to-end
- [ ] Fix any bugs found
- [ ] Commit and push to GitHub
- [ ] Verify Vercel deployment

## Phase 9: Landing Page & Login Redesign
- [ ] Design new landing page
- [ ] Redesign login page
- [ ] Add onboarding flow
