export const initials = name => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
