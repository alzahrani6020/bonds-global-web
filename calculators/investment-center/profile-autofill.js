/**
 * Bonds Profile Autofill — Shared helper for investment-center calculators.
 * Loads the user's country from Supabase profile and sets the country selector.
 */
(function (global) {
  'use strict';

  function detectLanguage() {
    const html = document.documentElement;
    return html && html.lang === 'ar';
  }

  async function fillFromUserProfile() {
    const isAr = detectLanguage();
    if (!window.supabaseClient) {
      alert(isAr ? 'عميل Supabase غير متوفر.' : 'Supabase client not available.');
      return;
    }
    try {
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) {
        alert(isAr ? 'يرجى تسجيل الدخول أولاً.' : 'Please log in first.');
        return;
      }
      const { data: profile, error } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error || !profile) {
        alert(isAr ? 'لم يتم العثور على ملف شخصي.' : 'Profile not found.');
        return;
      }
      if (profile.country) {
        const countrySelect = document.getElementById('country');
        if (countrySelect) {
          countrySelect.value = profile.country;
          countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      alert(
        isAr
          ? 'تم جلب الملف الشخصي. يمكنك الآن استخدام "ملء تلقائي من بيانات السوق" لتحميل بيانات الدولة.'
          : 'Profile loaded. You can now use "Auto-fill from market data" to load country data.'
      );
    } catch (err) {
      alert(isAr ? 'حدث خطأ أثناء جلب الملف الشخصي.' : 'Error fetching profile.');
    }
  }

  global.BondsProfileAutofill = { fillFromUserProfile };
})(window);
