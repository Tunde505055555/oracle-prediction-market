import { deployContract } from 'genlayer';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const contractPath = path.join(__dirname, '../contracts/oracle.py');
  const contractCode = fs.readFileSync(contractPath, 'utf-8');

  console.log('Deploying Oracle prediction market contract...');
  console.log('Contract size:', contractCode.length, 'bytes');

  const address = await deployContract({
    code: contractCode,
    args: [],
  });

  console.log('\n✅ Contract deployed at:', address);
  console.log('\nNext step — add to frontend/.env:');
  console.log('NEXT_PUBLIC_CONTRACT_ADDRESS=' + address);
}

main().catch(console.error);
