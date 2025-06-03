declare global {
  namespace Express {
    interface Request {
      csrfToken?: string | undefined;
    }
  }
}

export {};
