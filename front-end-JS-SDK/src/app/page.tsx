"use client";
import { useState } from "react";
import TransgateConnect from "@zkpass/transgate-js-sdk";
import { ethers } from "ethers";
import AttestationABI from "./AttestationABI.json";
import { Res } from "./lib/types";
import verifyEvmBasedResult from "./verifyEvmBasedResult";
import Image from "next/image";

interface ValidationCardProps {
  schemaId: string;
  validationName: string;
  appid: string;
}

const ValidationCard: React.FC<ValidationCardProps> = ({ schemaId, validationName, appid }) => {
  const [result, setResult] = useState<any>();
  const [attestAtationTx, setAttestAtationTx] = useState<string>();
  const [status, setStatus] = useState<{ success: boolean, message?: string, code?: number }>({ success: false });

  const isErrorWithMessage = (error: unknown): error is { message: string } => {
    return typeof error === 'object' && error !== null && 'message' in error;
  };

  const isValidJSON = (str: string) => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  const start = async () => {
    try {
      const connector = new TransgateConnect(appid);
      const isAvailable = await connector.isTransgateAvailable();
      if (!isAvailable) {
        return alert("Please install zkPass TransGate");
      }
      if (window.ethereum == null) {
        return alert("MetaMask not installed");
      }
      if (Number(window.ethereum.chainId) !== 2810) {
        return alert("Please switch to Morph network");
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const account = await signer.getAddress();

      const contractAddress = "0x79208010a972D0C0a978a9073bd0dcb659152072";
      const contract = new ethers.Contract(
        contractAddress,
        AttestationABI,
        signer
      );

      const res = await connector.launch(schemaId, account) as Res ;
      setResult(res);

      const isVerified = verifyEvmBasedResult(res, schemaId)

      if (!isVerified) {
        setStatus({ success: false, message: "Invalid result" });
        return;
      }

      const taskId = ethers.hexlify(ethers.toUtf8Bytes(res.taskId));
      schemaId = ethers.hexlify(ethers.toUtf8Bytes(schemaId));

      const chainParams = {
        taskId,
        schemaId,
        uHash: res.uHash,
        recipient: account,
        publicFieldsHash: res.publicFieldsHash,
        validator: res.validatorAddress,
        allocatorSignature: res.allocatorSignature,
        validatorSignature: res.validatorSignature,
      };

      const t = await contract.attest(chainParams);
      setAttestAtationTx(t.hash);
      setStatus({ success: true });
    } catch (err: unknown) {
      if (isErrorWithMessage(err)) {
        if (isValidJSON(err.message)) {
          const errorMessage = JSON.parse(err.message);
          if (errorMessage.code === 110001) {
            setStatus({ success: false, code: 110001 });
          } else {
            setStatus({ success: false, message: err.message });
          }
        } else {
          setStatus({ success: false, message: err.message });
        }
        console.log("error", err);
      } else {
        console.log("Unknown error", err);
      }
    }
  };

  return (
    <div className="bg-black text-white p-4 rounded-lg shadow-md mb-4 border border-gray-700 text-center">
      <h3 className="text-lg font-bold mb-2">{validationName}</h3>
      <button onClick={start} className="bg-[#c5ff4a] text-black px-4 py-2 rounded mb-2 mx-auto block">Run</button>
      
      {status.success && (
        <>
          <Image src="/pass.png" alt="Pass" width={100} height={100} className="mx-auto" />
          {attestAtationTx && (
            <div className="break-words">
              <label className="block text-sm font-bold mb-1">AttestationTx:</label>
              <a href={"https://explorer-holesky.morphl2.io/tx/" + attestAtationTx} target="_blank" rel="noopener noreferrer" className="text-blue-500 break-words">
                {attestAtationTx}
              </a>
            </div>
          )}
        </>
      )}
      
      {status.success === false && (
        <div>
          
          {status.code === 110001 && (
            <div>Error</div>
          )}
          {status.message && (
            <>
              <div>{status.message}</div>
            <Image src="/fail.png" alt="Fail" width={100} height={100} className="mx-auto" />
          
            </>
            )}
        </div>
      )}
      {/* <div className="text-center">
        <img 
          src="/fail.png" 
          alt="Fail" 
          width={100} 
          height={100} 
          className="mx-auto" 
        />
        <label className="block text-sm font-bold mb-1">Error</label>
        <div>The user does not meet the requirements.</div>
      </div> */}
    </div>
  );
};

export default function Home() {
  const [appid, setAppid] = useState<string>(
    "fb7dc08a-3b93-47c0-a553-5de29be89eb6"
  );

  return (
    <main className="p-4">
      <h1 className="text-white text-center mb-8">zkPass Transgate Sportybet validator</h1>
      <div className="grid gap-9 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
        <ValidationCard schemaId="b7724d4fce7d480ca9658730fdc4b8cf" validationName="Has Sportybet Account " appid={appid} />
        <ValidationCard schemaId="b7724d4fce7d480ca9658730fdc4b8cf" validationName="Sportybet account balance is more than 1 GHs" appid={appid} />
        <ValidationCard schemaId="99f040afb92349a28991ffed8bd0c146" validationName="Credit Card number added to sportybet" appid={appid} />
        {/* <ValidationCard schemaId="b5a8ca28820f407abc64af649f44f3e7" validationName="Mobile money number added to sportybet" appid={appid} /> */}
        <ValidationCard schemaId="8dc601044ea04ce9a8fed4cbc061b11b" validationName="Transacted on SportyBet in the last 7 days" appid={appid} />
      </div>
    </main>
  );
}