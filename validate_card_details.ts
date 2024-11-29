import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormControl } from '@angular/forms';
import { StripeCardComponent, StripeService } from 'ngx-stripe';
import { StripeCardElementOptions, StripeElementsOptions } from '@stripe/stripe-js';
import { PaymentService } from 'src/app/service/payment.service';
import { Router } from '@angular/router';
import { CommunicationService } from 'src/app/service/communication.service';
import { UserControllerService } from 'src/app/service/user-controller.service';
import { SaveCouponComponent } from '../../update-profile/save-coupon/save-coupon.component';
import { MatDialog } from '@angular/material/dialog';
import { NotificationEnum } from 'src/app/model/notification-enum';
import { UserSetupNotificationService } from 'src/app/service/user-setup-notification.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-validate-card-details',
  templateUrl: './validate-card-details.component.html',
  styleUrls: ['./validate-card-details.component.scss']
})
export class ValidateCardDetailsComponent implements OnInit {

  cardForm: FormGroup;
  countriesList: any;
  @ViewChild(StripeCardComponent)
  card!: StripeCardComponent;

  cardOptions: StripeCardElementOptions = {
    style: {
      base: {
        iconColor: '#666EE8',
        color: '#31325F',
        fontWeight: '300',
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSize: '15px',
        '::placeholder': {
          color: '#CFD7E0'
        },
      }
    },
  };

  elementsOptions: StripeElementsOptions = {
    locale: 'en',

  };

  // month list
  months: any[] = [
    { value: '01', viewValue: 'January' },
    { value: '02', viewValue: 'February' },
    { value: '03', viewValue: 'March' },
    { value: '04', viewValue: 'April' },
    { value: '05', viewValue: 'May' },
    { value: '06', viewValue: 'June' },
    { value: '07', viewValue: 'July' },
    { value: '08', viewValue: 'August' },
    { value: '09', viewValue: 'September' },
    { value: '10', viewValue: 'October' },
    { value: '11', viewValue: 'November' },
    { value: '12', viewValue: 'December' }
  ];
  data: any;
  errorMsg: any;
  tokenId: any;
  cardId: any;
  brand: any;
  cvc_check: any;
  exp_Month: any;
  exp_Year: any;
  funding: any;
  last4Digit: any;
  zipCode: any;
  clientIp: any;
  paymentStatus: any;
  payingLoader: any;
  getDetailsLoader: any = false;
  customerId: any
  clientSecret: any;
  teamLength: any;
  // coupOnvariables
  discountPercentage: any;
  coupOnName: any;
  // amounnt to be detected
  Amount: any;
  hidecardDetails: any = false;
  selectedPlanData: any;
  paymentloader: any = false;
  couponapplied: any = false;

  constructor(
    private fb: FormBuilder,
    private stripeService: StripeService,
    private billingService: PaymentService,
    private communicationService: CommunicationService,
    private userService: UserControllerService,
    private dialog: MatDialog,
    private router: Router,
    private cdr: ChangeDetectorRef, // Inject ChangeDetectorRef,
    private notificationService: UserSetupNotificationService,
  ) {
    this.cardForm = this.fb.group({
      FullName: ['', [Validators.required]],
      cardNumber: [''],
      Address1: ['', [Validators.required]],
      Address2: [''],
      city: ['', [Validators.required]],
      country: ['India', [Validators.required]],
      coupOnCode: ['']

    });
  }

  ngOnInit(): void {
    this.countriesList = this.billingService.countries;
    this.selectedPlanData = JSON.parse(localStorage.getItem('SelectedPlanData') || '{}');

    if (Object.keys(this.selectedPlanData).length === 0) {
      // let planDetails = {
      //   totalAmount: 19,
      //   planId: '001',
      //   openBillingAddress: false
      // };
      // this.selectedPlanData = planDetails;
      // localStorage.setItem('SelectedPlanData', JSON.stringify(planDetails));
      this.communicationService.callingDataFromUserSetupSideBar(3)
        this.router.navigateByUrl('/user-setup/select-plan')
    }

    this.Amount = this.selectedPlanData?.totalAmount


    this.getCardDetails();
    this.getTeamList();

  }




  openCoupon() {

    let planDetails = {
      ...this.selectedPlanData,
      openBillingAddress: false,
      couponname: this.cardForm.get('coupOnCode')?.value

    }
    const dialog = this.dialog.open(SaveCouponComponent, {
      backdropClass: 'backdrop-background',
      disableClose: false,
      data: planDetails
    });
    dialog.afterClosed().subscribe((res: any) => {
      if (res) {

        this.coupOnName = res?.couponName;
        this.couponapplied = true;
        this.discountPercentage = res.discount;
        this.getCardDetails()
        this.checkForCoupOn()
        if (environment.validCoupons.includes(this.coupOnName?.toLowerCase()) && this.discountPercentage == '100%') {
          this.hidecardDetails = true;
          this.next();
        }
      } else {
        this.cardForm.get('coupOnCode')?.setValue('')
        this.getCardDetails()
      }

    })
  }

  checkForCoupOn() {
    if (environment.validCoupons.includes(this.coupOnName?.toLowerCase()) && this.discountPercentage == '100%') {
      this.hidecardDetails = true;
      // if the user uses the dfy2023 or btt 2023 no need for billing
      // this.next()

    } else {
      if (this.coupOnName?.toLowerCase() == 'alr90d') {
        this.hidecardDetails = false;
        this.Amount = 1
      } else {
        this.Amount = this.selectedPlanData.totalAmount * this.teamLength

      }
      this.hidecardDetails = false
    }
  }

  onSubmit(): void {
    if (this.cardForm.invalid) {
        Object.values(this.cardForm.controls).forEach(control => {
            control.markAsTouched();
        });
    } else {
        const couponControl = this.cardForm.get('coupOnCode');
        if (!this.couponapplied && couponControl && couponControl.value) {
            this.applycoupon();
        }
        this.SaveBillingInfo();
    }
}


  applycoupon() {
    let data = {
      couponName: this.cardForm.get('coupOnCode')?.value,
      planId: this.selectedPlanData.planId,
    }
    if (this.cardForm.get('coupOnCode')?.value.length > 0) {
      this.billingService.saveCoupon(data).subscribe((res: any) => { })
    }
  }
  // step-1
  // saving billing info

  SaveBillingInfo() {

    this.paymentloader = true;
    this.paymentStatus = "saving Info"

    let countryCode = ''
    for (let eachCountry of this.countriesList) {
      if (eachCountry.name == this.cardForm.value.country) {
        countryCode = eachCountry.code
      }
    }

    const PayloadToSend = {
      firstName: this.cardForm.value.FullName,
      lastName: "",
      transactionId: '',
      address: this.cardForm.value.Address1,
      addressLine2: this.cardForm.value.Address2,
      countryCode: countryCode,
      postalCode: '',
      city: this.cardForm.value.city,
      country: this.cardForm.value.country,
      state: "",
      phoneNumber: ''
    }
    this.billingService.saveBilling(PayloadToSend).subscribe((res: any) => {
      if (res.responseCodeJson.code == 200) {
        const objectDetails = res.object;
        this.customerId = objectDetails.customerId
        if (this.hidecardDetails == false) {
          this.IntialisethePayment(this.customerId)


        } else {
          this.next()
        }
      }

    },  (error) => {
      this.handleBillingError(error)
    })

  }

  // step:2
  // processing the payment

  IntialisethePayment(customerId: any) {
    if (this.customerId) {
      this.createToken()
    }

  }



  createToken(): void {
    this.paymentStatus = "Processing Payment"
    this.stripeService
      .createToken(this.card.element, { name: this.cardForm.get('FullName')?.value })
      .subscribe((response: any) => {
        if (response.token) {
          // Use the token      
          this.errorMsg = '';
          this.tokenId = response.token.id;
          this.cardId = response.token.card.id;
          this.brand = response.token.card.brand;
          this.cvc_check = response.token.card.cvc_check;
          this.exp_Month = response.token.card.exp_month;
          this.exp_Year = response.token.card.exp_year;
          this.funding = response.token.card.funding;
          this.last4Digit = response.token.card.last4;
          this.zipCode = response.token.card.address_zip;
          this.clientIp = response.token.client_ip;
          this.savecardDetails()
        }
        else if (response.error) {
          this.paymentStatus = ''
          this.paymentloader = false;
          this.errorMsg = response.error.message || '';
        }

      });
  }

  // step:3
  // saving card details

  savecardDetails() {

    this.paymentStatus = 'saving Card Details'
    const payload = {
      transactionAmount: '$' + this.Amount,
      noOfUsers: this.teamLength,
      couponId: "",
      couponName: this.coupOnName,
      planId: this.selectedPlanData.planId,
      brand: this.brand,
      cvc_Check: this.cvc_check,
      exp_Month: this.exp_Month,
      exp_Year: this.exp_Year,
      funding: this.funding,
      cardId: this.cardId,
      last4Digit: this.last4Digit,
      clientIp: this.clientIp,
      tokenId: this.tokenId,
      customerId: this.customerId
    }

    this.billingService.saveBillingCardDetails(payload).subscribe((res: any) => {
      if (res.code == 200) {
        this.createPaymentIntent()
      }

    } , (error) => {
      this.handleBillingError(error)
    })

  }
  // step:4
  // creating Payment Intent


  createPaymentIntent() {
    this.paymentStatus = 'creating Payment Intent'


    let data = {
      amount: this.Amount,
      customerId: this.customerId
    }

    this.billingService.createPaymentIntent(data).subscribe((resp: any) => {

      this.clientSecret = resp.object;
      this.confirmingCardPayment()

    }, (error) => {
      this.handleBillingError(error)
    })
  }


  // step:5
  // confirming card payment


  confirmingCardPayment() {
    this.paymentStatus = 'confirming Card Payment';
    const confirmIntentPayload = {
      status: 0,
      statusMessage: "",
      paymentMethodId: "",
      couponName: this.coupOnName ? this.coupOnName : '',
      planId: this.selectedPlanData.planId,
      transactionAmount: '$' + this.Amount,
      customerId: this.customerId,
      noOfUsers: this.teamLength,
    }

    this.stripeService.confirmCardPayment(this.clientSecret, {
      payment_method: {
        card: this.card.element,
        billing_details: {
          name: this.cardForm.value.FullName,
        },
      },
    }).subscribe(
      (res: any) => {
        if (res.paymentIntent && res.paymentIntent.status == "succeeded") {
          this.errorMsg = '';

          this.paymentStatus = 'Payment In Progress';
          confirmIntentPayload.status = 1;
          confirmIntentPayload.statusMessage = res.paymentIntent.status;
          confirmIntentPayload.paymentMethodId = res.paymentIntent.payment_method;
          this.notificationService.addNotification(
            'Your payment has been successfully processed, thank you for your subscription!',
            'success',
            NotificationEnum.SUCCESS
          );


        } else if (res.error) {
          
          confirmIntentPayload.status = 2
          confirmIntentPayload.statusMessage = res.error.message;
          this.paymentStatus = ''
          this.errorMsg = res.error.message
          

          this.notificationService.addNotification(
            res.error.message,
            'error',
            NotificationEnum.DANGER
          );
        }
        this.confirmIntent(confirmIntentPayload);
        
      },
      (error) => {
        confirmIntentPayload.status = 2;
        confirmIntentPayload.statusMessage = 'Error'
        this.confirmIntent(confirmIntentPayload);

      }
    );
  }




  confirmIntent(payload: any) {
    this.billingService.confirmIntent(payload).subscribe((res: any) => {
      this.paymentloader = false;
      if (res.code == 200){
        this.paymentStatus = 'Payment Done'
        this.next()
      }
      // this.rediectToChkCredential()
    },
    (error) => {
     this.handleBillingError(error)
    }
  )
  }


  next() {
    this.communicationService.callingDataFromUserSetupSideBar(5)
    this.router.navigateByUrl('/user-setup/confirmation')


  }





  getCardDetails(): void {
    this.getDetailsLoader = true
    this.billingService.retrivebillingAddress().subscribe((resp: any) => {
      this.getDetailsLoader = false

      // this.retriveCoupon()

      if (resp.responseCodeJson.code == 200) {
        const userobject = resp.object;

        if (userobject) {
          this.cardForm.patchValue({
            FullName: userobject?.firstName,
            Address1: userobject?.address,
            Address2: userobject?.addressLine2,
            city: userobject?.city,
            coupOnCode: userobject?.couponName,
            country: userobject?.country

          });
          this.coupOnName = userobject?.couponName

        }

        this.cdr.detectChanges();
      } else {
        // this.openCoupon();
      }
    },(error) => {
      this.handleBillingError(error)
    }
  );
  }

  retriveCoupon() {
    this.billingService.retriveCoupon().subscribe((res: any) => {
      this.getDetailsLoader = false;
      if (res.responseCodeJson.code == 200) {
        this.coupOnName = res.object
        this.cardForm.patchValue({
          coupOnCode: res.object
        });
        if (environment.validCoupons.includes(this.coupOnName?.toLowerCase())) {
          this.discountPercentage = '100%'
          this.hidecardDetails = true;
        } else {
          this.hidecardDetails = false;
        }
        this.checkForCoupOn()

      } else {
        this.hidecardDetails = false;

      }
    },
  (error) => {
        this.handleBillingError(error)
      }
    )

  }

  getTeamList() {
    this.userService.getUserData().subscribe((resp: any) => {
      if (resp.responseCodeJson.code === 200) {
        this.teamLength = resp.list.length
        // this.checkForCoupOn()
        // this.openCoupon()
      }
    })

  }


   handleBillingError(message: string) {
    this.paymentloader = false;
    this.notificationService.addNotification(
      '',
      'Something went wrong. Please raise a support request.',
      NotificationEnum.DANGER
    );
  }


}
