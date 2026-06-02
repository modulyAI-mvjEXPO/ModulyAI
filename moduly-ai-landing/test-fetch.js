async function test() {
  try {
    const s3Res = await fetch('http://localhost:8888/.netlify/functions/list-files');
    if (!s3Res.ok) throw new Error('S3 fetch failed');
    const text = await s3Res.text();
    console.log('Response text length:', text.length);
    console.log('Starts with:', text.slice(0, 100));
    const s3Data = JSON.parse(text);
    console.log('Parsed successfully:', Array.isArray(s3Data.files));
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
