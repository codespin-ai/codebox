// Consent page HTML generation

export function generateConsentHtml(clientName: string, csrfToken: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize Access - Codebox</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 40px;
      max-width: 420px;
      width: 100%;
    }
    h1 {
      color: #1a202c;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #718096;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .client-info {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .client-name {
      font-weight: 600;
      color: #2d3748;
      font-size: 16px;
    }
    .permissions {
      margin-bottom: 24px;
    }
    .permissions h3 {
      color: #4a5568;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .permission-item {
      display: flex;
      align-items: center;
      padding: 8px 0;
      color: #4a5568;
      font-size: 14px;
    }
    .permission-item::before {
      content: "ok";
      color: #48bb78;
      font-weight: bold;
      margin-right: 10px;
    }
    .buttons {
      display: flex;
      gap: 12px;
    }
    button {
      flex: 1;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .allow {
      background: #667eea;
      color: white;
      border: none;
    }
    .allow:hover { background: #5a67d8; }
    .deny {
      background: white;
      color: #4a5568;
      border: 1px solid #e2e8f0;
    }
    .deny:hover { background: #f7fafc; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize Access</h1>
    <p class="subtitle">An application is requesting access to execute commands</p>

    <div class="client-info">
      <div class="client-name">${clientName}</div>
    </div>

    <div class="permissions">
      <h3>This application will be able to:</h3>
      <div class="permission-item">Execute commands in Docker containers</div>
      <div class="permission-item">Read and write files in workspaces</div>
      <div class="permission-item">List and manage workspaces</div>
    </div>

    <form method="POST" action="/authorize" style="margin-top: 24px;">
      <input type="hidden" name="csrf_token" value="${csrfToken}">
      <div class="buttons">
        <button type="submit" name="action" value="deny" class="deny">Deny</button>
        <button type="submit" name="action" value="allow" class="allow">Allow</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}
