import { describe, it, expect } from 'vitest';
import { getUserDisplayName, getUserInitials, type UserDisplayFields } from './user';

const baseUser: UserDisplayFields = {
  username: null,
  fullName: null,
  firstName: null,
  lastName: null,
  primaryEmailAddress: null,
};

describe('getUserDisplayName', () => {
  it('prefers username when present', () => {
    expect(getUserDisplayName({ ...baseUser, username: 'jdoe' })).toBe('jdoe');
  });

  it('falls back to fullName when username is null', () => {
    expect(getUserDisplayName({ ...baseUser, fullName: 'Jane Doe' })).toBe('Jane Doe');
  });

  it('falls back to email when both names are null', () => {
    expect(
      getUserDisplayName({ ...baseUser, primaryEmailAddress: { emailAddress: 'j@x.com' } })
    ).toBe('j@x.com');
  });

  it('never returns an empty string', () => {
    expect(getUserDisplayName(baseUser)).toBe('User');
  });
});

describe('getUserInitials', () => {
  it('combines first and last initials', () => {
    expect(getUserInitials({ ...baseUser, firstName: 'Jane', lastName: 'Doe' })).toBe('JD');
  });

  it('single name yields one letter', () => {
    expect(getUserInitials({ ...baseUser, firstName: 'Jane' })).toBe('J');
  });

  it('derives from email when names are null', () => {
    expect(
      getUserInitials({ ...baseUser, primaryEmailAddress: { emailAddress: 'jane@x.com' } })
    ).toBe('JA');
  });

  it('all-null returns the terminal A', () => {
    expect(getUserInitials(baseUser)).toBe('A');
  });
});
