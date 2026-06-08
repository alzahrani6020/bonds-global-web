import os

def update_arabic():
    path = 'c:/Users/vip/bonds-global-web/admin/messages.html'
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    old_script_start = "  <script>\n    const STORAGE_KEY = 'bonds_contact_messages';"
    old_script_end = "    window.addEventListener('load', renderMessages);\n  </script>"

    new_script = '''  <script>
    async function fetchMessages() {
      try {
        const res = await fetch('/api/admin-messages');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        if (data.demo) document.getElementById('demoIndicator').style.display = 'inline-block';
        return data.messages || [];
      } catch (e) {
        document.getElementById('demoIndicator').style.display = 'inline-block';
        return [
          { id: 'demo-1', name: 'أحمد محمد', email: 'ahmed@example.com', phone: '+966501234567', sector: 'صناعة', service: 'جدوى', message: 'أود الاستفسار عن دراسة جدوى لمصنع بلاستيك في الرياض.', read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
          { id: 'demo-2', name: 'سارة عبدالله', email: 'sara@example.com', phone: '+971501234567', sector: 'تجارة', service: 'تحليل مالي', message: 'أحتاج تحليل مالي لسلسلة متاجرنا.', read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
        ];
      }
    }

    async function toggleRead(id) {
      try {
        await fetch('/api/admin-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read', id })
        });
      } catch(e) {}
      refreshMessages();
    }

    async function deleteMessage(id) {
      if (!confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;
      try {
        await fetch('/api/admin-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id })
        });
      } catch(e) {}
      refreshMessages();
    }

    function timeAgo(dateStr) {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = Math.floor((now - d) / 60000);
      if (diff < 1) return 'الآن';
      if (diff < 60) return 'منذ ' + diff + ' دقيقة';
      const hrs = Math.floor(diff / 60);
      if (hrs < 24) return 'منذ ' + hrs + ' ساعة';
      const days = Math.floor(hrs / 24);
      return 'منذ ' + days + ' يوم';
    }

    async function renderMessages() {
      const msgs = await fetchMessages();
      const total = msgs.length;
      const unread = msgs.filter(m => !m.read).length;
      const today = msgs.filter(m => new Date(m.date || m.created_at).toDateString() === new Date().toDateString()).length;
      document.getElementById('totalMessages').textContent = total;
      document.getElementById('unreadMessages').textContent = unread;
      document.getElementById('todayMessages').textContent = today;
      const container = document.getElementById('messageList');
      if (msgs.length === 0) {
        container.innerHTML = '<div class="loading">لا توجد رسائل</div>';
        return;
      }
      container.innerHTML = msgs.map(m => `
        <div class="message-card ${m.read ? '' : 'unread'}">
          <div class="message-header">
            <span class="message-sender">${m.name} ${m.read ? '' : '<span class="badge badge--new">جديد</span>'}</span>
            <span class="message-time">${timeAgo(m.created_at)}</span>
          </div>
          <div class="message-email">${m.email}${m.phone ? ' | ' + m.phone : ''}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem;">${m.sector || ''} ${m.service ? '→ ' + m.service : ''}</div>
          <div class="message-body">${m.message}</div>
          <div class="message-actions">
            <button class="btn-sm ${m.read ? 'btn-primary' : 'btn-secondary'}" onclick="toggleRead('${m.id}')">${m.read ? 'تعيين غير مقروء' : 'تعيين مقروء'}</button>
            <button class="btn-sm btn-danger" onclick="deleteMessage('${m.id}')">حذف</button>
          </div>
        </div>
      `).join('');
      const badge = document.getElementById('msgBadge');
      if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'inline-block' : 'none'; }
    }

    function refreshMessages() {
      document.getElementById('messageList').innerHTML = '<div class="loading">جارِ التحديث...</div>';
      setTimeout(renderMessages, 300);
    }

    window.addEventListener('load', renderMessages);
  </script>'''

    start = c.find(old_script_start)
    end = c.find(old_script_end) + len(old_script_end)
    if start != -1 and end != -1:
        c = c[:start] + new_script + c[end:]
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        print('Updated admin/messages.html')
    else:
        print('Could not find script block in admin/messages.html')

def update_english():
    path = 'c:/Users/vip/bonds-global-web/en/admin/messages.html'
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    old_script_start = "  <script>\n    const STORAGE_KEY = 'bonds_contact_messages';"
    old_script_end = "    window.addEventListener('load', renderMessages);\n  </script>"

    new_script = '''  <script>
    async function fetchMessages() {
      try {
        const res = await fetch('/api/admin-messages');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        if (data.demo) document.getElementById('demoIndicator').style.display = 'inline-block';
        return data.messages || [];
      } catch (e) {
        document.getElementById('demoIndicator').style.display = 'inline-block';
        return [
          { id: 'demo-1', name: 'Ahmad Mohammed', email: 'ahmed@example.com', phone: '+966501234567', sector: 'Manufacturing', service: 'Feasibility', message: 'I would like to inquire about a feasibility study for a plastic factory in Riyadh.', read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
          { id: 'demo-2', name: 'Sara Abdullah', email: 'sara@example.com', phone: '+971501234567', sector: 'Retail', service: 'Financial Analysis', message: 'Need financial analysis for our retail chain expansion.', read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
        ];
      }
    }

    async function toggleRead(id) {
      try {
        await fetch('/api/admin-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read', id })
        });
      } catch(e) {}
      refreshMessages();
    }

    async function deleteMessage(id) {
      if (!confirm('Are you sure you want to delete this message?')) return;
      try {
        await fetch('/api/admin-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id })
        });
      } catch(e) {}
      refreshMessages();
    }

    function timeAgo(dateStr) {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = Math.floor((now - d) / 60000);
      if (diff < 1) return 'Just now';
      if (diff < 60) return diff + 'm ago';
      const hrs = Math.floor(diff / 60);
      if (hrs < 24) return hrs + 'h ago';
      const days = Math.floor(hrs / 24);
      return days + 'd ago';
    }

    async function renderMessages() {
      const msgs = await fetchMessages();
      const total = msgs.length;
      const unread = msgs.filter(m => !m.read).length;
      const today = msgs.filter(m => new Date(m.date || m.created_at).toDateString() === new Date().toDateString()).length;
      document.getElementById('totalMessages').textContent = total;
      document.getElementById('unreadMessages').textContent = unread;
      document.getElementById('todayMessages').textContent = today;
      const container = document.
