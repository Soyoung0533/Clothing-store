// Supabase 연결 설정
const SUPABASE_URL = "https://tkdbhzrloirfwolxtmor.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xI71FCb7eEMvq_HVtLOPbA_jkAzWhKp";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// 다음 단계의 script.js에서도 사용할 수 있도록 전역으로 공개합니다.
window.db = db;

// 페이지가 열릴 때 shop_products 상품 수로 연결을 확인합니다.
(async function checkSupabaseConnection() {
  const { count, error } = await db
    .from("shop_products")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error(error.message);
    return;
  }

  console.log(`연결 성공: 상품 ${count}개`);
})();
