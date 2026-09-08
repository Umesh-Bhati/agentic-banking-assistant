import {describe,it,expect,vi} from 'vitest';
import {requireApprovedFactor} from '../../src/services/actions/mfa-registry.service.js';
import {AuthorizationService} from '../../src/services/actions/authorization.service.js';
import {ActionState} from '@boit/shared-types';
import {query,principal} from '../helpers/database.js';

describe('Bank-approved MFA factors',()=>{
    it.each([{data:null,error:null},{data:null,error:{message:'offline'}},{data:{factor_id:'other'},error:null}])('rejects unregistered or unavailable factor %j',async result=>{
        await expect(requireApprovedFactor({from:()=>query(result)} as any,principal,'external-factor')).rejects.toThrow('Bank-approved');
    });
    it('binds factor registration to both customer and authenticated user',async()=>{
        const q=query({data:{factor_id:'registered'},error:null});
        await requireApprovedFactor({from:()=>q} as any,principal,'registered');
        expect(q.eq).toHaveBeenCalledWith('user_id',principal.authUserId);
        expect(q.eq).toHaveBeenCalledWith('customer_id',principal.customerId);
    });
    it('does not challenge a directly enrolled provider factor absent bank registration',async()=>{
        const listFactors=vi.fn();const challenge=vi.fn();
        const service=new AuthorizationService({getById:async()=>({id:'action',customerId:principal.customerId,authUserId:principal.authUserId,status:ActionState.PENDING_AUTHORIZATION,expiresAt:new Date(Date.now()+100000).toISOString()})} as any,{from:()=>query({data:null,error:null})} as any);
        await expect(service.challenge('action',principal,'external-factor',{auth:{mfa:{listFactors,challenge}}} as any)).rejects.toThrow('Bank-approved');
        expect(listFactors).not.toHaveBeenCalled();expect(challenge).not.toHaveBeenCalled();
    });
});
