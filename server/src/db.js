import dns from 'node:dns';
import mongoose from 'mongoose';

function usePublicDnsIfLoopbackOnly() {
  const servers = dns.getServers();
  const onlyLoopback =
    servers.length > 0 && servers.every((server) => server === '127.0.0.1' || server === '::1');
  if (onlyLoopback) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
}

export async function connectDb(uri) {
  mongoose.set('strictQuery', true);
  usePublicDnsIfLoopbackOnly();
  await mongoose.connect(uri);
  console.log(`MongoDB connected (${mongoose.connection.name})`);
}
