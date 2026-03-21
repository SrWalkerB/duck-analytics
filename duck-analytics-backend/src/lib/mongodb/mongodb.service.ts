import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';
import { EncryptionService } from '../crypto/encryption.service';

@Injectable()
export class MongoDBService implements OnModuleDestroy {
  private clients = new Map<string, MongoClient>();

  constructor(private readonly encryption: EncryptionService) {}

  async getDb(
    encryptedConnectionString: string,
    database: string,
  ): Promise<Db> {
    const connectionString = this.encryption.decrypt(encryptedConnectionString);
    const key = `${connectionString}/${database}`;

    if (!this.clients.has(key)) {
      const client = new MongoClient(connectionString);
      await client.connect();
      this.clients.set(key, client);
    }

    return this.clients.get(key)!.db(database);
  }

  async testConnection(
    encryptedConnectionString: string,
    database: string,
  ): Promise<void> {
    const connectionString = this.encryption.decrypt(encryptedConnectionString);
    const client = new MongoClient(connectionString);
    try {
      await client.connect();
      await client.db(database).command({ ping: 1 });
    } finally {
      await client.close();
    }
  }

  async testRawConnection(
    connectionString: string,
    database: string,
  ): Promise<void> {
    const client = new MongoClient(connectionString);
    try {
      await client.connect();
      await client.db(database).command({ ping: 1 });
    } finally {
      await client.close();
    }
  }

  async onModuleDestroy() {
    for (const client of this.clients.values()) {
      await client.close();
    }
    this.clients.clear();
  }
}
