import { Member, Rank, Snack } from '../../types';
import { AddMemberModal } from '../AddMemberModal';
import { AddCourtModal } from '../AddCourtModal';
import { ManageProductsModal } from '../ManageProductsModal';
import { ImportMembersModal } from '../ImportMembersModal';

interface GlobalModalsProps {
  members: Member[];
  rankMemory: Record<string, Rank>;
  snacks: Snack[];
  onSaveSnacks: (snacks: Snack[]) => void;

  showAddMember: boolean;
  onCloseAddMember: () => void;
  onAddMember: (name: string, rank: Rank) => void;

  showAddCourt: boolean;
  onCloseAddCourt: () => void;
  onAddCourt: (name: string) => void;

  showManageProducts: boolean;
  onCloseManageProducts: () => void;

  showImport: boolean;
  onCloseImport: () => void;
  onImportMembers: (members: { name: string; rank: Rank }[], isSession: boolean) => void;
  importIsSession: boolean;
}

/** The handful of top-level modals reachable from more than one tab (add member/court, products, LINE import). */
export function GlobalModals({
  members, rankMemory, snacks, onSaveSnacks,
  showAddMember, onCloseAddMember, onAddMember,
  showAddCourt, onCloseAddCourt, onAddCourt,
  showManageProducts, onCloseManageProducts,
  showImport, onCloseImport, onImportMembers, importIsSession,
}: GlobalModalsProps) {
  return (
    <>
      <AddMemberModal
        open={showAddMember}
        onClose={onCloseAddMember}
        onAdd={onAddMember}
        existingNames={members.map(m => m.name)}
        rankMemory={rankMemory}
      />
      <AddCourtModal open={showAddCourt} onClose={onCloseAddCourt} onAdd={onAddCourt} />
      <ManageProductsModal open={showManageProducts} onClose={onCloseManageProducts} snacks={snacks} onSave={onSaveSnacks} />
      <ImportMembersModal
        open={showImport}
        onClose={onCloseImport}
        onImport={onImportMembers}
        rankMemory={rankMemory}
        existingNames={members.map(m => m.name)}
        isSessionMode={importIsSession}
      />
    </>
  );
}
