#!/usr/bin/env bun

interface Transaction {
  idx: number
  id: string
  name: string
  due_date: string
  amount: string
  created_at: string
  plan_id: string
  is_budget: boolean
  user_id: string
  is_done: boolean
}

async function main() {
  const file1 = Bun.file('data/planned_transactions_rows.json')
  const file2 = Bun.file('data/planned_transactions_rows(1).json')

  const [data1, data2] = await Promise.all([
    file1.json() as Promise<Transaction[]>,
    file2.json() as Promise<Transaction[]>,
  ])

  const merged = [...data1, ...data2].map((tx, idx) => ({
    ...tx,
    idx,
  }))

  await Bun.write(
    'data/planned_transactions_merged.json',
    JSON.stringify(merged, null, 2),
  )

  console.log(
    `Merged ${data1.length} + ${data2.length} = ${merged.length} transactions`,
  )
  console.log('Output: data/planned_transactions_merged.json')
}

void main()
