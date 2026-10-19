async function testLogin(username, password) {
  const res = await fetch("http://127.0.0.1:5001/em-yeu-tieng-viet-demo/us-central1/accountLogin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { username, password } })
  });
  const data = await res.json();
  return data;
}

async function run() {
  console.log("=== KIỂM THỬ ĐĂNG NHẬP KHÔNG CẦN GMAIL ===");

  // 1. Admin login
  const adminRes = await testLogin("admin", "admin");
  console.log("1. Admin Login (admin/admin):", adminRes.result?.success ? "SUCCESS" : adminRes.error);
  if (adminRes.result) {
    console.log("   Role:", adminRes.result.role, "| Token length:", adminRes.result.token?.length);
  }

  // 2. Teacher login
  const teacherRes = await testLogin("giaovien01", "GV123456");
  console.log("2. Teacher Login (giaovien01/GV123456):", teacherRes.result?.success ? "SUCCESS" : teacherRes.error);
  if (teacherRes.result) {
    console.log("   Role:", teacherRes.result.role, "| DisplayName:", teacherRes.result.user?.displayName);
  }

  // 3. Student login
  const studentRes = await testLogin("HS001", "HS123456");
  console.log("3. Student Login (HS001/HS123456):", studentRes.result?.success ? "SUCCESS" : studentRes.error);
  if (studentRes.result) {
    console.log("   Role:", studentRes.result.role, "| Student:", studentRes.result.student?.displayAlias);
  }

  // 4. Bad password test
  const badRes = await testLogin("admin", "wrongpass");
  console.log("4. Bad password check (expect error):", badRes.error?.message || "Should have failed");
}

run().catch(console.error);
