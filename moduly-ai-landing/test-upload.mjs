
async function test() {
    try {
        const res = await fetch('http://localhost:8888/.netlify/functions/upload-to-utho', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'test/file.txt',
                contentType: 'text/plain',
                base64Data: Buffer.from('hello world').toString('base64')
            })
        });

        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Body:', text);
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
