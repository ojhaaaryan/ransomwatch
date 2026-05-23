// ============================================================
// FileTreeViewer.tsx — Animated directory tree with encryption status
// ============================================================
import { useState } from 'react';
import { Folder, FolderOpen, File, Lock, Shield } from 'lucide-react';
import type { SimulatorState } from '../types';

interface TreeNode {
  name: string;
  type: 'dir' | 'file' | 'canary';
  ext?: string;
  children?: TreeNode[];
}

const VAULT_TREE: TreeNode = {
  name: 'test_vault/',
  type: 'dir',
  children: [
    {
      name: 'finance/',
      type: 'dir',
      children: [
        { name: 'Q1_Revenue_Report_2024.xlsx',    type: 'file', ext: '.xlsx' },
        { name: 'Q2_Revenue_Report_2024.xlsx',    type: 'file', ext: '.xlsx' },
        { name: 'Annual_Budget_2024.xlsx',        type: 'file', ext: '.xlsx' },
        { name: 'Invoice_INV-2024-0091.pdf',      type: 'file', ext: '.pdf'  },
        { name: 'Tax_Filings_FY2023.pdf',         type: 'file', ext: '.pdf'  },
        { name: '.canary_q4_forecast.xlsx',       type: 'canary', ext: '.xlsx' },
      ],
    },
    {
      name: 'hr/',
      type: 'dir',
      children: [
        { name: 'Employee_Records_2024.xlsx',     type: 'file', ext: '.xlsx' },
        { name: 'Salary_Structure_Confidential.docx', type: 'file', ext: '.docx' },
        { name: 'NDA_Template_v3.docx',           type: 'file', ext: '.docx' },
        { name: '.canary_employee_ssn.docx',      type: 'canary', ext: '.docx' },
      ],
    },
    {
      name: 'engineering/',
      type: 'dir',
      children: [
        { name: 'Architecture_Diagram_v5.pdf',    type: 'file', ext: '.pdf'  },
        { name: 'DB_Schema_Production.sql',       type: 'file', ext: '.sql'  },
        { name: 'Source_Backup_2024-03.bak',      type: 'file', ext: '.bak'  },
        { name: '.canary_source_master.bak',      type: 'canary', ext: '.bak' },
      ],
    },
    {
      name: 'legal/',
      type: 'dir',
      children: [
        { name: 'Client_Contract_Acme_Corp.pdf',  type: 'file', ext: '.pdf'  },
        { name: 'Litigation_Notes_2023.docx',     type: 'file', ext: '.docx' },
        { name: '.canary_litigation.pdf',         type: 'canary', ext: '.pdf' },
      ],
    },
    {
      name: 'ops/',
      type: 'dir',
      children: [
        { name: 'Backup_Manifest.db',             type: 'file', ext: '.db'   },
        { name: 'SIEM_Config_Export.db',          type: 'file', ext: '.db'   },
        { name: 'Network_Topology_Map.pdf',       type: 'file', ext: '.pdf'  },
        { name: '.canary_db_master.db',           type: 'canary', ext: '.db' },
      ],
    },
  ],
};

const EXT_COLOR: Record<string, string> = {
  '.xlsx': '#00d4ff', '.docx': '#00ff41', '.pdf': '#ff4400',
  '.db':   '#9b59b6', '.bak':  '#ffaa00', '.sql': '#00d4ff',
};

interface NodeProps {
  node: TreeNode;
  depth: number;
  encryptedFiles: string[];
  currentFile: string | null;
}

function TreeNodeComponent({ node, depth, encryptedFiles, currentFile }: NodeProps) {
  const [open, setOpen] = useState(true);
  const isDir = node.type === 'dir';
  const isCanary = node.type === 'canary';

  const isEncrypted = encryptedFiles.some(f => f.includes(node.name.replace('.locked', '')));
  const isActive = currentFile?.includes(node.name);

  const extColor = node.ext ? (EXT_COLOR[node.ext] ?? '#00ff41') : '#00ff41';

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-0.5 px-1 rounded cursor-pointer transition-all hover:bg-[#00ff4108]"
        style={{
          paddingLeft: `${depth * 14 + 4}px`,
          background: isActive ? '#ff440015' : undefined,
          borderLeft: isActive ? '2px solid #ff4400' : '2px solid transparent',
        }}
        onClick={() => isDir && setOpen(o => !o)}
      >
        {/* Icon */}
        {isDir ? (
          open
            ? <FolderOpen size={11} className="text-[#ffaa00] shrink-0" />
            : <Folder     size={11} className="text-[#ffaa00] shrink-0" />
        ) : isCanary ? (
          <Shield size={11} className="text-[#ffaa00] shrink-0" style={{ filter: 'drop-shadow(0 0 4px #ffaa00)' }} />
        ) : isEncrypted ? (
          <Lock size={11} className="text-[#ff0040] shrink-0" />
        ) : (
          <File size={11} className="shrink-0" style={{ color: extColor }} />
        )}

        {/* Name */}
        <span
          className="text-[10px] font-['Share_Tech_Mono'] truncate"
          style={{
            color: isDir ? '#ffaa00' :
                   isCanary ? '#ffaa00' :
                   isEncrypted ? '#ff0040' :
                   isActive ? '#ff4400' :
                   extColor,
            opacity: isDir ? 1 : 0.85,
            textDecoration: isEncrypted ? 'line-through' : 'none',
          }}
        >
          {node.name}
          {isEncrypted && <span className="ml-1 text-[8px]">.locked</span>}
        </span>

        {/* Badges */}
        {isCanary && (
          <span
            className="ml-auto text-[7px] font-['Orbitron'] font-bold px-1 py-0.5 rounded shrink-0"
            style={{ background: '#ffaa0020', color: '#ffaa00', border: '1px solid #ffaa0040' }}
          >
            🪤 TRAP
          </span>
        )}
        {isActive && (
          <span
            className="ml-auto text-[7px] font-['Orbitron'] font-bold px-1 py-0.5 rounded shrink-0 pulse-red"
            style={{ background: '#ff440020', color: '#ff4400', border: '1px solid #ff440040' }}
          >
            ENCRYPTING
          </span>
        )}
      </div>

      {/* Children */}
      {isDir && open && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNodeComponent
              key={child.name}
              node={child}
              depth={depth + 1}
              encryptedFiles={encryptedFiles}
              currentFile={currentFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  sim: SimulatorState;
}

export default function FileTreeViewer({ sim }: Props) {
  const encryptedCount  = sim.encryptedFiles.length;
  const totalFiles      = 37;
  const protectedCount  = totalFiles - encryptedCount;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="font-['Orbitron'] text-sm font-bold tracking-widest text-[#ffaa00]"
          style={{ textShadow: '0 0 8px #ffaa0080' }}
        >
          ◈ FILE VAULT TREE
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-['Share_Tech_Mono'] text-[#00ff4160]">
            🟢 {protectedCount} SAFE
          </span>
          <span className="text-[9px] font-['Share_Tech_Mono'] text-[#ff004060]">
            🔴 {encryptedCount} LOCKED
          </span>
        </div>
      </div>

      {/* Tree */}
      <div
        className="flex-1 overflow-y-auto rounded"
        style={{ background: '#000', border: '1px solid #00ff4115' }}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 sticky top-0"
          style={{ background: '#050f05', borderBottom: '1px solid #00ff4115', zIndex: 1 }}
        >
          <span className="w-2 h-2 rounded-full bg-[#ff0040]" />
          <span className="w-2 h-2 rounded-full bg-[#ffaa00]" />
          <span className="w-2 h-2 rounded-full bg-[#00ff41]" />
          <span className="ml-2 text-[9px] font-['Share_Tech_Mono'] text-[#00ff4140]">
            /srv/fileserver/test_vault
          </span>
        </div>

        <div className="p-2">
          <TreeNodeComponent
            node={VAULT_TREE}
            depth={0}
            encryptedFiles={sim.encryptedFiles}
            currentFile={sim.currentFile}
          />
        </div>
      </div>

      {/* Progress */}
      <div className="mt-2">
        <div className="cyber-progress">
          <div
            className="cyber-progress-bar"
            style={{
              width: `${(encryptedCount / totalFiles) * 100}%`,
              background: 'linear-gradient(90deg, #ff4400, #ff0040)',
            }}
          />
        </div>
        <div className="flex justify-between text-[9px] font-['Share_Tech_Mono'] mt-1">
          <span style={{ color: '#ff4400' }}>
            {Math.round((encryptedCount / totalFiles) * 100)}% encrypted
          </span>
          <span style={{ color: '#00ff41' }}>
            {Math.round((protectedCount / totalFiles) * 100)}% protected
          </span>
        </div>
      </div>
    </div>
  );
}
