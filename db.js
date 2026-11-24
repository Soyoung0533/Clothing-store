// PRIDE Supabase 연결 설정

const SUPABASE_URL = "https://tkdbhzrloirfwolxtmor.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xI71FCb7eEMvq_HVtLOPbA_jkAzWhkP";

// Supabase 연결 객체
const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// 쇼핑몰이 열릴 때 상품 개수 확인
(async function checkSupabaseConnection() {
  try {
    const { count, error } = await db
      .from("shop_products")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error(error.message);
      return;
    }

    console.log(`연결 성공: 상품 ${count ?? 0}개`);

  } catch (error) {
    console.error(error.message);
  }
})();