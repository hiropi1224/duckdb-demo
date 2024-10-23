import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";


const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};

const initDuckDB = async (
  setMyDuckDB: React.Dispatch<React.SetStateAction<duckdb.AsyncDuckDB | null>>
) => {
  console.log("initDuckDB");
  // Select a bundle based on browser checks
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  // Instantiate the asynchronous version of DuckDB-wasm
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  setMyDuckDB(db);
  const c = await db.connect();
  await c.query(`
    INSTALL json;
  `);
};

import type { StructRowProxy } from "apache-arrow";

function App() {
  const [duckdbInitialized, setDuckDBInitialized] = useState(false);
  const [duckdbLoaded, setDuckDBLoaded] = useState(false);
  const [myDuckDB, setMyDuckDB] = useState<duckdb.AsyncDuckDB | null>(null);
  const [cityData, setCityData] = useState<StructRowProxy[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);

  const origin = window.location.origin;
  const path = window.location.pathname;
  let basename = origin;
  if (path !== "/") {
    basename = origin + path;
  }

  const loadQuery = `
    INSTALL json;
    LOAD json;
    CREATE TABLE cities AS SELECT * FROM read_json_auto('${basename}/data.json');
  `;

  useEffect(() => {
    if (!duckdbInitialized) {
      initDuckDB(setMyDuckDB);
      setDuckDBInitialized(true);
    }
  }, [duckdbInitialized]);

  useEffect(() => {
    const loadDuckDB = async (db: duckdb.AsyncDuckDB) => {
      const conn = await db.connect();
      await conn.query(loadQuery);
      await conn.close();
      setDuckDBLoaded(true);
    };
    if (myDuckDB) {
      loadDuckDB(myDuckDB);
    }
  }, [loadQuery, myDuckDB]);

  console.log(cityData);
  
  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      {
        duckdbLoaded ? (
          <div>
            <p>DuckDB loaded</p>
            <input
              type="number"
              placeholder="都市IDを入力"
              onChange={(e) => setSelectedCityId(Number(e.target.value))}
            />
            <button onClick={async () => {
              if (myDuckDB && selectedCityId !== null) {
                const conn = await myDuckDB.connect();
                const result = await conn.query(`
                  SELECT * FROM cities WHERE id = ${selectedCityId}
                `);
                const rows = result.toArray();
                setCityData(rows);
                console.log(rows);
                await conn.close();
              }
            }}>
              特定の都市データを表示
            </button>
            {cityData.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>名前</th>
                    <th>人口</th>
                  </tr>
                </thead>
                <tbody>
                  {cityData.map((city, index) => (
                    <tr key={index}>
                      <td>{city.id}</td>
                      <td>{city.name}</td>
                      <td>{city.population}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <p>DuckDB not loaded</p>
        )
      }
    </>
  )
}

export default App
