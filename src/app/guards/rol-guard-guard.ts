import { CanMatchFn } from '@angular/router';

export const rolGuardGuard: CanMatchFn = (route, segments) => {
  return true;
};
