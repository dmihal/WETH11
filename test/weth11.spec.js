const { expect } = require("chai");
const { signERC2612Permit } = require('eth-permit');

const MAX = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

describe("WETH11", function() {
  let user1;
  let user2;
  let user3;
  let weth;
  let receiver;

  before(async () => {
    ([user1, user2, user3] = await ethers.getSigners());

    const TestTransferReceiver = await ethers.getContractFactory('TestTransferReceiver');
    receiver = await TestTransferReceiver.deploy();
  });

  beforeEach(async () => {
    const WETH = await ethers.getContractFactory('WETH11');
    weth = await WETH.deploy();
  });

  describe('deployment', async () => {
    it('returns the name', async () => {
      let name = await weth.name()
      expect(name).to.equal('Wrapped Ether 11')
    })

    it('returns the symbol', async () => {
      let symbol = await weth.symbol()
      expect(symbol).to.equal('WETH11')
    })

    it('deposits ether', async () => {
      const balanceBefore = await weth.balanceOf(await user1.getAddress())
      await weth.deposit({ value: 1 })
      const balanceAfter = await weth.balanceOf(await user1.getAddress())
      expect(balanceAfter).to.equal(balanceBefore.add('1'))
    })

    it('deposits ether using the legacy method', async () => {
      const balanceBefore = await weth.balanceOf(await user1.getAddress())
      await user1.sendTransaction({ to: weth.address, value: 1 })
      const balanceAfter = await weth.balanceOf(await user1.getAddress())
      expect(balanceAfter).to.equal(balanceBefore.add('1'))
    })

    it('deposits ether to another account', async () => {
      const balanceBefore = await weth.balanceOf(await user2.getAddress())
      await weth.depositTo(await user2.getAddress(), { value: 1 })
      const balanceAfter = await weth.balanceOf(await user2.getAddress())
      expect(balanceAfter).to.equal(balanceBefore.add('1'))
    })

    it('deposits with depositToAndCall', async () => {
      await weth.depositToAndCall(receiver.address, '0x11', { value: 1 })

      const events = await receiver.getPastEvents()
      events.length.should.equal(1)
      events[0].event.should.equal('TransferReceived')
      events[0].returnValues.token.should.equal(weth.address)
      events[0].returnValues.sender.should.equal(await user1.getAddress())
      events[0].returnValues.value.should.equal('1')
      events[0].returnValues.data.should.equal('0x11')
    })

    describe('with a positive balance', async () => {
      beforeEach(async () => {
        await weth.deposit({ value: 10 })
      })

      it('returns the Ether balance as total supply', async () => {
        const totalSupply = await weth.totalSupply()
        expect(totalSupply).to.equal('10')
      })

      it('withdraws ether', async () => {
        const balanceBefore = await weth.balanceOf(await user1.getAddress())
        const ethBalanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(await user1.getAddress()))

        const tx = await weth.withdraw(1)
        const receipt = await tx.wait()
        const ethSpentOnGas = ethers.BigNumber.from(receipt.gasUsed).mul(tx.gasPrice) 

        const balanceAfter = await weth.balanceOf(await user1.getAddress())
        const ethBalanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(await user1.getAddress()))

        expect(balanceAfter).to.equal(balanceBefore.sub('1'))
        expect(ethBalanceAfter).to.equal(ethBalanceBefore.add('1').sub(ethSpentOnGas))
      })

      it('withdraws ether to another account', async () => {
        const fromBalanceBefore = await weth.balanceOf(await user1.getAddress())
        const toBalanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(await user2.getAddress()))

        await weth.withdrawTo(await user2.getAddress(), 1)

        const fromBalanceAfter = await weth.balanceOf(await user1.getAddress())
        const toBalanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(await user2.getAddress()))

        expect(fromBalanceAfter).to.equal(fromBalanceBefore.sub('1'))
        expect(toBalanceAfter).to.equal(toBalanceBefore.add('1'))
      })

      it('should not withdraw beyond balance', async () => {
        await expect(weth.withdraw(100))
          .to.revertedWith('WETH: burn amount exceeds balance')
        await expect(weth.withdrawTo(await user2.getAddress(), 100))
          .to.revertedWith('WETH: burn amount exceeds balance')
        await expect(weth.withdrawFrom(await user1.getAddress(), await user2.getAddress(), 100))
          .to.revertedWith('WETH: burn amount exceeds balance')
      })

      it('transfers ether', async () => {
        const balanceBefore = await weth.balanceOf(await user2.getAddress())
        await weth.transfer(await user2.getAddress(), 1)
        const balanceAfter = await weth.balanceOf(await user2.getAddress())
        expect(balanceAfter).to.equal(balanceBefore.add('1'))
      })

      it('withdraws ether by transferring to address(0)', async () => {
        const balanceBefore = await weth.balanceOf(await user1.getAddress())
        const ethBalanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(await user1.getAddress()))


        await weth.transfer('0x0000000000000000000000000000000000000000', 1)
        const balanceAfter = await weth.balanceOf(await user1.getAddress())
        const ethBalanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(await user1.getAddress()))

        expect(balanceAfter).to.equal(balanceBefore.sub('1'))
        expect(ethBalanceAfter).to.equal(ethBalanceBefore.add('1'))
      })

      it('transfers ether using transferFrom', async () => {
        const balanceBefore = await weth.balanceOf(await user2.getAddress())
        await weth.transferFrom(await user1.getAddress(), await user2.getAddress(), 1)
        const balanceAfter = await weth.balanceOf(await user2.getAddress())
        expect(balanceAfter).to.equal(balanceBefore.add('1'))
      })

      it('withdraws ether by transferring from someone to address(0)', async () => {
        const balanceBefore = await weth.balanceOf(await user1.getAddress())
        const ethBalanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(await user1.getAddress()))
        
        await weth.transferFrom(await user1.getAddress(), '0x0000000000000000000000000000000000000000', 1)
        
        const balanceAfter = await weth.balanceOf(await user1.getAddress())
        const ethBalanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(await user1.getAddress()))
        
        expect(balanceAfter).to.equal(balanceBefore.sub('1'))
        expect(ethBalanceAfter).to.equal(ethBalanceBefore.add('1'))
      })

      it('transfers with transferAndCall', async () => {
        await weth.transferAndCall(receiver.address, 1, '0x11')

        const events = await receiver.getPastEvents()
        events.length.should.equal(1)
        events[0].event.should.equal('TransferReceived')
        events[0].returnValues.token.should.equal(weth.address)
        events[0].returnValues.sender.should.equal(await user1.getAddress())
        events[0].returnValues.value.should.equal('1')
        events[0].returnValues.data.should.equal('0x11')
      })

      it('should not transfer beyond balance', async () => {
        await expect(weth.transfer(await user2.getAddress(), 100))
          .to.revertedWith('WETH: transfer amount exceeds balance')
        await expect(weth.transferFrom(await user1.getAddress(), await user2.getAddress(), 100))
          .to.revertedWith('WETH: transfer amount exceeds balance')
        await expect(weth.transferAndCall(receiver.address, 100, '0x11'))
          .to.revertedWith('WETH: transfer amount exceeds balance')
      })

      it('approves to increase allowance', async () => {
        const allowanceBefore = await weth.allowance(await user1.getAddress(), await user2.getAddress())
        await weth.approve(await user2.getAddress(), 1)
        const allowanceAfter = await weth.allowance(await user1.getAddress(), await user2.getAddress())
        expect(allowanceAfter).to.equal(allowanceBefore.add('1'))
      })

      it('approves with approveAndCall', async () => {
        await weth.approveAndCall(receiver.address, 1, '0x11', { from: user1 })

        const events = await receiver.getPastEvents()
        events.length.should.equal(1)
        events[0].event.should.equal('ApprovalReceived')
        events[0].returnValues.token.should.equal(weth.address)
        events[0].returnValues.spender.should.equal(await user1.getAddress())
        events[0].returnValues.value.should.equal('1')
        events[0].returnValues.data.should.equal('0x11')
      })

      it('approves to increase allowance with permit', async () => {
        const permitResult = await signERC2612Permit(network.provider, weth.address, await user1.getAddress(), await user2.getAddress(), '1')
        await weth.permit(await user1.getAddress(), await user2.getAddress(), '1', permitResult.deadline, permitResult.v, permitResult.r, permitResult.s)
        const allowanceAfter = await weth.allowance(await user1.getAddress(), await user2.getAddress())
        allowanceAfter.toString().should.equal('1')
      })

      it('does not approve with expired permit', async () => {
        const permitResult = await signERC2612Permit(network.provider, weth.address, await user1.getAddress(), await user2.getAddress(), '1')
        await expect(weth.permit(
          await user1.getAddress(), await user2.getAddress(), '1', 0, permitResult.v, permitResult.r, permitResult.s),
          ).to.revertWith('WETH: Expired permit')
      })

      it('does not approve with invalid permit', async () => {
        const permitResult = await signERC2612Permit(network.provider, weth.address, await user1.getAddress(), await user2.getAddress(), '1')
        await expect(
          weth.permit(await user1.getAddress(), await user2.getAddress(), '2', permitResult.deadline, permitResult.v, permitResult.r, permitResult.s),
          ).to.revertWith('WETH: invalid permit')
      })

      describe('with a positive allowance', async () => {
        beforeEach(async () => {
          await weth.approve(await user2.getAddress(), 1)
        })

        it('transfers ether using transferFrom and allowance', async () => {
          const balanceBefore = await weth.balanceOf(await user3.getAddress())
          await weth.connect(user2).transferFrom(await user1.getAddress(), await user2.getAddress(), 1)
          const balanceAfter = await weth.balanceOf(await user3.getAddress())
          expect(balanceAfter).to.equal(balanceBefore.add('1'))
        })

        it('should not transfer beyond allowance', async () => {
          await expect(weth.connect(user2).transferFrom(await user1.getAddress(), await user2.getAddress(), 2))
            .to.be.revertedWith('WETH: request exceeds allowance')
        })
  
        it('withdraws ether using withdrawFrom and allowance', async () => {
          const fromBalanceBefore = await weth.balanceOf(await user1.getAddress())
          const toBalanceBefore = ethers.BigNumber.from(await ethers.provider.getBalance(await user3.getAddress()))

          await weth.connect(user2).withdrawFrom(await user1.getAddress(), await user3.getAddress(), 1)

          const fromBalanceAfter = await weth.balanceOf(await user1.getAddress())
          const toBalanceAfter = ethers.BigNumber.from(await ethers.provider.getBalance(await user3.getAddress()))

          expect(fromBalanceAfter).to.equal(fromBalanceBefore.sub('1'))
          expect(toBalanceAfter).to.equal(toBalanceBefore.add('1'))
        })

        it('should not withdraw beyond allowance', async () => {
          await expect(weth.connect(user2).withdrawFrom(await user1.getAddress(), await user3.getAddress(), 2))
            .to.be.reverted
            // .to.be.revertedWith('WETH: request exceeds allowance')
        })
      })

      describe('with a maximum allowance', async () => {
        beforeEach(async () => {
          await weth.approve(await user2.getAddress(), MAX)
        })

        it('does not decrease allowance using transferFrom', async () => {
          await weth.connect(user2).transferFrom(await user1.getAddress(), await user2.getAddress(), 1)
          const allowanceAfter = await weth.allowance(await user1.getAddress(), await user2.getAddress())
          expect(allowanceAfter).to.equal(MAX)
        })

        it('does not decrease allowance using withdrawFrom', async () => {
          await weth.connect(user2).withdrawFrom(await user1.getAddress(), await user2.getAddress(), 1)
          const allowanceAfter = await weth.allowance(await user1.getAddress(), await user2.getAddress())
          expect(allowanceAfter).to.equal(MAX)
        })
      })
    })
  })
});
