declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      name: string;
      mobile: string;
      points: number;
      createdAt: Date;
      sub: number; // JWT payload의 sub 필드 (userId와 동일)
    }
    
    interface Request {
      user?: User;
    }
  }
}

export {};