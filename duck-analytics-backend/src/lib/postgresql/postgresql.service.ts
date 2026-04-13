import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { EncryptionService } from '../crypto/encryption.service';

const { Pool } = pg;
type PoolType = InstanceType<typeof Pool>;

@Injectable()
export class PostgreSQLService implements OnModuleDestroy {
  private pools = new Map<string, PoolType>();

  constructor(private readonly encryption: EncryptionService) {}

  getPool(encryptedConnectionString: string, database: string): PoolType {
    const connectionString = this.encryption.decrypt(encryptedConnectionString);
    const key = `${connectionString}/${database}`;

    if (!this.pools.has(key)) {
      const pool = new Pool({
        connectionString,
        database,
        max: 10,
      });
      this.pools.set(key, pool);
    }

    return this.pools.get(key)!;
  }

  async testConnection(
    encryptedConnectionString: string,
    database: string,
  ): Promise<void> {
    const connectionString = this.encryption.decrypt(encryptedConnectionString);
    const pool = new Pool({
      connectionString,
      database,
      max: 1,
    });
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  }

  async testRawConnection(
    connectionString: string,
    database: string,
  ): Promise<void> {
    const pool = new Pool({
      connectionString,
      database,
      max: 1,
    });
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  }

  async onModuleDestroy() {
    for (const pool of this.pools.values()) {
      await pool.end();
    }
    this.pools.clear();
  }
}
