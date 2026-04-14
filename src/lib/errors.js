// 基于探索发现的API错误模式实现的错误处理

class SyncError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class TokenExpiredError extends SyncError {
  constructor(message = 'Feishu tenant access token expired') {
    super(message, 'TOKEN_EXPIRED', 401);
  }
}

class InvalidInputError extends SyncError {
  constructor(message = 'Invalid input data') {
    super(message, 'INVALID_INPUT', 400);
  }
}

class PermissionDeniedError extends SyncError {
  constructor(message = 'Permission denied') {
    super(message, 'PERMISSION_DENIED', 403);
  }
}

class RateLimitedError extends SyncError {
  constructor(message = 'Rate limit exceeded', retryAfter = 60) {
    super(message, 'RATE_LIMITED', 429);
    this.retryAfter = retryAfter;
  }
}

/**
 * 格式化错误响应 (基于探索发现的API错误响应格式)
 */
function formatErrorResponse(error) {
  const response = {
    error: {
      code: error.code || 'unknown_error',
      message: error.message || 'An unexpected error occurred'
    }
  };

  if (error.details) {
    response.error.details = error.details;
  }

  if (error.retryAfter) {
    response.error.retryAfter = error.retryAfter;
  }

  return response;
}

/**
 * 结构化日志记录 (参考 mcp-health-check.js 的 [HookName] 前缀模式)
 */
function logError(moduleName, error, context = {}) {
  const timestamp = new Date().toISOString();
  console.error(`[${moduleName}] ${timestamp} - ${error.message}`, {
    error: error.stack,
    code: error.code,
    statusCode: error.statusCode,
    context
  });
}

module.exports = {
  SyncError,
  TokenExpiredError,
  InvalidInputError,
  PermissionDeniedError,
  RateLimitedError,
  formatErrorResponse,
  logError
};