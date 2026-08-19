import { HttpInterceptorFn } from '@angular/common/http';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const code = location.pathname.startsWith('/room/')
    ? location.pathname.split('/')[2]
    : '';
  const raw =
    (code && localStorage.getItem(`pp.participant.${code}`)) ||
    (code && localStorage.getItem(`pp.participant.${code}`)) ||
    null;
  const token = raw ? (JSON.parse(raw) as { token?: string }).token : '';

  return next(
    req.clone({
      withCredentials: true,
      setHeaders: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(token
          ? {
              'x-participant-token': token,
            }
          : {}),
      },
    })
  );
};
