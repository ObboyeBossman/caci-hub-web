// src/modules/membership/pages/Home.ts

import type { PageModule } from '../../../types/module.types'
import { renderBreadcrumbs } from '../../../shell/Breadcrumbs'
import { getCurrentUser } from '@core/auth'
import { supabase } from '@core/supabase'

export default {
  async render(container: HTMLElement) {
    const user = getCurrentUser()
    const firstName = user?.fullName?.split(' ')[0] ?? 'Member'
    
    // Greeting logic based on time of day
    const hour = new Date().getHours()
    let greeting = 'Good Evening'
    if (hour < 12) greeting = 'Good Morning'
    else if (hour < 17) greeting = 'Good Afternoon'

    // Fetch announcements and giving data
    let announcements: any[] = []
    let transactions: any[] = []
    let isLoading = true

    // Inject CSS
    const cssId = 'member-home-css'
    if (!document.getElementById(cssId)) {
      const style = document.createElement('style')
      style.id = cssId
      style.textContent = `
        .mh-container {
          padding: 24px 0 48px;
          display: flex;
          flex-direction: column;
          gap: 32px;
          animation: 0.4s ease-out 0s 1 normal both running awFadeUp;
        }
        
        .mh-hero {
          background: linear-gradient(135deg, var(--caci-blue), var(--caci-blue-dark));
          border-radius: var(--radius-xl, 16px);
          padding: 40px;
          color: white;
          box-shadow: 0 10px 30px rgba(0, 75, 160, 0.15);
          position: relative;
          overflow: hidden;
        }
        
        .mh-hero::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -10%;
          width: 50vw;
          height: 150%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%);
          transform: rotate(30deg);
          pointer-events: none;
        }

        .mh-greeting {
          font-size: 1.1rem;
          font-weight: 500;
          opacity: 0.9;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mh-name {
          font-size: 2.25rem;
          font-weight: 700;
          margin: 8px 0 0;
          letter-spacing: -0.02em;
        }
        
        .mh-date {
          margin-top: 16px;
          font-size: 0.85rem;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          padding: 6px 14px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .mh-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
        }

        .mh-card {
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg, 12px);
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .mh-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
        }

        .mh-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          border-bottom: 1px solid var(--border-default);
          padding-bottom: 16px;
        }

        .mh-card-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(0, 75, 160, 0.08);
          color: var(--caci-blue-light);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
        }

        .mh-card-title {
          font-size: 1.05rem;
          font-weight: 600;
          margin: 0;
          color: var(--text-primary);
        }

        .mh-quick-actions {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .mh-btn-action {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: var(--bg-page);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md, 8px);
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .mh-btn-action i {
          font-size: 1.4rem;
          color: var(--text-primary);
          transition: transform 0.2s;
        }

        .mh-btn-action:hover {
          background: rgba(0, 75, 160, 0.04);
          border-color: rgba(0, 75, 160, 0.2);
          color: var(--caci-blue-light);
        }
        
        .mh-btn-action:hover i {
          transform: scale(1.1);
          color: var(--caci-blue-light);
        }

        .mh-btn-action span {
          font-size: 0.85rem;
          font-weight: 500;
        }

        .mh-list-item {
          display: flex;
          gap: 16px;
          padding: 12px 0;
          border-bottom: 1px solid var(--border-default);
        }
        
        .mh-list-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .mh-list-icon {
          flex-shrink: 0;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--caci-blue-light);
          margin-top: 6px;
        }

        .mh-list-content h4 {
          margin: 0 0 4px;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .mh-list-content p {
          margin: 0 0 4px;
          font-size: 0.85rem;
          color: var(--text-secondary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .mh-list-meta {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .mh-empty {
          text-align: center;
          padding: 24px;
          color: var(--text-muted);
          font-size: 0.9rem;
          background: var(--bg-page);
          border-radius: 8px;
          border: 1px dashed var(--border-default);
        }
      `
      document.head.appendChild(style)
    }

    const render = () => {
      // Date formatter
      const today = new Date()
      const dateString = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(today)

      container.innerHTML = `
        <div class="mh-container">
          <!-- Hero Section -->
          <div class="mh-hero">
            <p class="mh-greeting"><i class="bi bi-sun-fill" style="color: #FFD166;"></i> ${greeting},</p>
            <h1 class="mh-name">${firstName}</h1>
            <div class="mh-date"><i class="bi bi-calendar3"></i> ${dateString}</div>
          </div>

          <div class="mh-grid">
            <!-- Quick Actions -->
            <div class="mh-card">
              <div class="mh-card-header">
                <div class="mh-card-icon"><i class="bi bi-lightning-charge-fill"></i></div>
                <h3 class="mh-card-title">Quick Actions</h3>
              </div>
              <div class="mh-quick-actions">
                <div class="mh-btn-action" onclick="window.location.hash='#/my-profile'">
                  <i class="bi bi-person-badge"></i>
                  <span>My Profile</span>
                </div>
                <div class="mh-btn-action" onclick="window.location.hash='#/giving'">
                  <i class="bi bi-wallet2"></i>
                  <span>Give / Tithe</span>
                </div>
                <div class="mh-btn-action" onclick="window.location.hash='#/directory'">
                  <i class="bi bi-journal-bookmark"></i>
                  <span>Directory</span>
                </div>
                <div class="mh-btn-action" onclick="window.location.hash='#/settings'">
                  <i class="bi bi-gear"></i>
                  <span>Settings</span>
                </div>
              </div>
            </div>

            <!-- Announcements -->
            <div class="mh-card">
              <div class="mh-card-header">
                <div class="mh-card-icon" style="background: rgba(34, 197, 94, 0.1); color: #22c55e;"><i class="bi bi-megaphone-fill"></i></div>
                <h3 class="mh-card-title">Recent Announcements</h3>
              </div>
              <div class="mh-list">
                ${isLoading ? `
                  <div style="display:flex; justify-content:center; padding: 24px;"><span class="aw-spinner"></span></div>
                ` : announcements.length > 0 ? announcements.map(a => `
                  <div class="mh-list-item">
                    <div class="mh-list-icon" ${a.is_pinned ? 'style="background: #ef4444;"' : ''}></div>
                    <div class="mh-list-content">
                      <h4>${a.title} ${a.is_pinned ? '<i class="bi bi-pin-angle-fill" style="color:#ef4444; font-size: 12px; margin-left:4px;"></i>' : ''}</h4>
                      <p>${a.body}</p>
                      <span class="mh-list-meta">${new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                `).join('') : `
                  <div class="mh-empty"><i class="bi bi-inbox" style="font-size: 24px; display:block; margin-bottom:8px;"></i>No new announcements.</div>
                `}
              </div>
            </div>

            <!-- Recent Giving -->
            <div class="mh-card">
              <div class="mh-card-header">
                <div class="mh-card-icon" style="background: rgba(210, 153, 34, 0.1); color: #d29922;"><i class="bi bi-heart-fill"></i></div>
                <h3 class="mh-card-title">Recent Giving</h3>
              </div>
              <div class="mh-list">
                ${isLoading ? `
                  <div style="display:flex; justify-content:center; padding: 24px;"><span class="aw-spinner"></span></div>
                ` : transactions.length > 0 ? transactions.map(t => `
                  <div class="mh-list-item">
                    <div class="mh-list-icon" style="border-radius:4px; background: rgba(0,0,0,0.05); width: 28px; height: 28px; display:flex; align-items:center; justify-content:center; margin-top:0;">
                      <i class="bi bi-currency-dollar" style="color: var(--text-muted);"></i>
                    </div>
                    <div class="mh-list-content">
                      <h4>${t.category?.name || 'General Contribution'}</h4>
                      <span class="mh-list-meta" style="color:#22c55e; font-weight: 600; font-size:0.85rem;">
                        ${t.currency} ${t.amount.toFixed(2)}
                      </span>
                      <span class="mh-list-meta" style="margin-left: 8px;">${new Date(t.transaction_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                `).join('') : `
                  <div class="mh-empty"><i class="bi bi-receipt" style="font-size: 24px; display:block; margin-bottom:8px;"></i>No recent transactions found.</div>
                `}
              </div>
            </div>
          </div>
        </div>
      `
      renderBreadcrumbs(container, [{ label: 'Home' }])
    }

    // Initial render logic with spinner
    render()

    // Fetch data asynchronously
    const loadData = async () => {
      if (!user?.id) return
      
      try {
        const { data: memberData } = await supabase
          .from('members')
          .select('id, assembly_id')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (memberData?.assembly_id) {
          const [ann, trans] = await Promise.all([
            // Fetch top 3 active announcements for this assembly
            supabase.from('announcement_posts')
              .select('id, title, body, created_at, is_pinned')
              .eq('assembly_id', memberData.assembly_id)
              .is('deleted_at', null)
              .order('is_pinned', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(3),
            
            // Fetch last 3 financial transactions for this member
            supabase.from('finance_transactions')
              .select('id, amount, currency, transaction_date, category:finance_categories(name)')
              .eq('member_id', memberData.id)
              .is('deleted_at', null)
              .order('transaction_date', { ascending: false })
              .limit(3)
          ])

          announcements = ann.data || []
          transactions = trans.data || []
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        isLoading = false
        if (container.isConnected) {
          render()
        }
      }
    }
    
    loadData()
  },

  destroy() {
    // Cleanup if necessary
  }
} satisfies PageModule
