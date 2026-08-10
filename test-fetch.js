fetch('http://localhost:3001/api/session?date=2026-04-07')
  .then(r => r.json())
  .then(d => {
    console.log("Response:", JSON.stringify(d).substring(0, 500));
    console.log("membersSnapshot length:", d.membersSnapshot?.length);
  })
  .catch(console.error);
