import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Button from './components/Button';
import Dialog from './components/Dialog';
import Badge from './components/Badge';
import { accountSelector } from '../../store/reducers/wallet/selectors';
import {
  getProviderAction,
} from '../../store/reducers/wallet/actions';
import { openAccountInfoAction, openConnectDialog } from '../../store/reducers/ui/actions';
import AccountInfo from './components/AccountInfo';

function ConnectWallet({ account, openDialog, openAccountInfo, getWalletInfo }) {
  useEffect(() => {
    getWalletInfo();
  }, []);
  return (
    <>
      {account.isConnected ? <Badge account={account} handleClick={openAccountInfo} /> : <Button onClick={openDialog} />}
      <Dialog />
      <AccountInfo account={account} />
    </>
  );
}

const mapStateToProps = (state) => ({
  account: accountSelector(state),
});


const mapDispatchToProps = (dispatch) => ({
  getWalletInfo: bindActionCreators(getProviderAction, dispatch),
  openDialog: bindActionCreators(openConnectDialog, dispatch),
  openAccountInfo: bindActionCreators(openAccountInfoAction, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ConnectWallet);
