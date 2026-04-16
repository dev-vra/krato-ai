import { describe, it, expect } from 'vitest';
import { userService } from '../src/services/UserService.js';

describe('UserService', () => {
  it('should create a new user', async () => {
    const user = await userService.create({
      name: 'John Doe',
      email: 'john@example.com',
    });

    expect(user.id).toBeDefined();
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('should find user by id', async () => {
    const created = await userService.create({
      name: 'Jane Doe',
      email: 'jane@example.com',
    });

    const found = await userService.findById(created.id);
    expect(found).toBeDefined();
    expect(found?.email).toBe('jane@example.com');
  });

  it('should return null for non-existent user', async () => {
    const found = await userService.findById('non-existent-id');
    expect(found).toBeNull();
  });

  it('should not allow duplicate emails', async () => {
    await userService.create({
      name: 'Test User',
      email: 'duplicate@example.com',
    });

    await expect(
      userService.create({
        name: 'Another User',
        email: 'duplicate@example.com',
      })
    ).rejects.toThrow('Email already exists');
  });

  it('should update user', async () => {
    const user = await userService.create({
      name: 'Original Name',
      email: 'original@example.com',
    });

    const updated = await userService.update(user.id, {
      name: 'Updated Name',
    });

    expect(updated?.name).toBe('Updated Name');
    expect(updated?.updatedAt).not.toBe(user.updatedAt);
  });

  it('should delete user', async () => {
    const user = await userService.create({
      name: 'To Delete',
      email: 'delete@example.com',
    });

    const deleted = await userService.delete(user.id);
    expect(deleted).toBe(true);

    const found = await userService.findById(user.id);
    expect(found).toBeNull();
  });

  it('should list all users', async () => {
    const users = await userService.findAll();
    expect(users.length).toBeGreaterThan(0);
  });
});
