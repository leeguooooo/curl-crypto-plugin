function collapseLineContinuations(value) {
  return value.replace(/\\\r?\n/g, ' ');
}

export function tokenizeShell(command) {
  const tokens = [];
  let current = '';
  let quote = '';
  let escaping = false;

  for (const char of collapseLineContinuations(command.trim())) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaping = true;
      continue;
    }

    if ((char === '"' || char === "'")) {
      if (!quote) {
        quote = char;
        continue;
      }
      if (quote === char) {
        quote = '';
        continue;
      }
    }

    if (!quote && /\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function assignOptionValue(token, optionName) {
  if (token === optionName) {
    return null;
  }

  if (token.startsWith(`${optionName}=`)) {
    return token.slice(optionName.length + 1);
  }

  return undefined;
}

function parseHeader(value) {
  const separator = value.indexOf(':');
  if (separator === -1) {
    return null;
  }

  const key = value.slice(0, separator).trim();
  const headerValue = value.slice(separator + 1).trim();

  if (!key) {
    return null;
  }

  return [key.toLowerCase(), headerValue];
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function parseQueryParams(url) {
  if (!url || !url.includes('?')) {
    return {};
  }

  try {
    const target = new URL(url, 'http://localhost');
    const params = {};
    target.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}

export function parseCurl(curlCommand) {
  if (typeof curlCommand !== 'string' || !curlCommand.trim()) {
    throw new Error('curl command is required');
  }

  const tokens = tokenizeShell(curlCommand);
  if (tokens.length === 0 || !/c?curl$/i.test(tokens[0])) {
    throw new Error('input does not look like a curl command');
  }

  let method = '';
  let url = '';
  let rawBody;
  const headers = {};
  let forceGet = false;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    const requestValue = assignOptionValue(token, '--request');
    if (requestValue !== undefined) {
      method = (requestValue ?? tokens[++index] ?? '').toUpperCase();
      continue;
    }

    if (token.startsWith('-X') && token !== '-X') {
      method = token.slice(2).toUpperCase();
      continue;
    }

    if (token === '-X') {
      method = (tokens[++index] ?? '').toUpperCase();
      continue;
    }

    const urlValue = assignOptionValue(token, '--url');
    if (urlValue !== undefined) {
      url = urlValue ?? tokens[++index] ?? url;
      continue;
    }

    const headerValue = assignOptionValue(token, '--header');
    if (headerValue !== undefined) {
      const parsedHeader = parseHeader(headerValue ?? tokens[++index] ?? '');
      if (parsedHeader) {
        headers[parsedHeader[0]] = parsedHeader[1];
      }
      continue;
    }

    if (token === '-H') {
      const parsedHeader = parseHeader(tokens[++index] ?? '');
      if (parsedHeader) {
        headers[parsedHeader[0]] = parsedHeader[1];
      }
      continue;
    }

    const dataFlags = ['--data', '--data-raw', '--data-binary', '--data-urlencode'];
    const matchedDataFlag = dataFlags.find((flag) => token === flag || token.startsWith(`${flag}=`));
    if (matchedDataFlag) {
      const value = assignOptionValue(token, matchedDataFlag);
      rawBody = value ?? tokens[++index] ?? rawBody;
      continue;
    }

    if (token === '-d') {
      rawBody = tokens[++index] ?? rawBody;
      continue;
    }

    if (token === '-G' || token === '--get') {
      forceGet = true;
      continue;
    }

    if (!token.startsWith('-') && !url) {
      url = token;
    }
  }

  const queryParams = parseQueryParams(url);
  const body = rawBody === undefined ? undefined : parseMaybeJson(rawBody);
  const resolvedMethod = forceGet ? 'GET' : method || (rawBody === undefined ? 'GET' : 'POST');

  return {
    raw: curlCommand,
    url,
    method: resolvedMethod,
    headers,
    body,
    rawBody,
    queryParams,
  };
}
