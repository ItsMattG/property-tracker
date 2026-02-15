import type { DB } from "./base";
import type {
  IPropertyRepository,
  IBankAccountRepository,
  ITransactionRepository,
  ILoanRepository,
  IRecurringRepository,
  IDocumentRepository,
  IComplianceRepository,
  IEmailRepository,
  IChatRepository,
  IPortfolioRepository,
  IScenarioRepository,
  IUserRepository,
  ITaskRepository,
  IFeedbackRepository,
  ITeamRepository,
  IForecastRepository,
  IPropertyValueRepository,
} from "./interfaces";

// Concrete imports
import { PropertyRepository } from "./property.repository";
import { BankAccountRepository } from "./bank-account.repository";
import { TransactionRepository } from "./transaction.repository";
import { LoanRepository } from "./loan.repository";
import { ChatRepository } from "./chat.repository";
import { UserRepository } from "./user.repository";
import { RecurringRepository } from "./recurring.repository";
import { DocumentRepository } from "./document.repository";
import { ComplianceRepository } from "./compliance.repository";
import { EmailRepository } from "./email.repository";
import { PortfolioRepository } from "./portfolio.repository";
import { ScenarioRepository } from "./scenario.repository";
import { TaskRepository } from "./task.repository";
import { FeedbackRepository } from "./feedback.repository";
import { TeamRepository } from "./team.repository";
import { ForecastRepository } from "./forecast.repository";
import { PropertyValueRepository } from "./property-value.repository";

export class UnitOfWork {
  // Private backing fields for lazy instantiation
  private _property?: IPropertyRepository;
  private _bankAccount?: IBankAccountRepository;
  private _transactions?: ITransactionRepository;
  private _loan?: ILoanRepository;
  private _recurring?: IRecurringRepository;
  private _document?: IDocumentRepository;
  private _compliance?: IComplianceRepository;
  private _email?: IEmailRepository;
  private _chat?: IChatRepository;
  private _portfolio?: IPortfolioRepository;
  private _scenario?: IScenarioRepository;
  private _user?: IUserRepository;
  private _task?: ITaskRepository;
  private _feedback?: IFeedbackRepository;
  private _team?: ITeamRepository;
  private _forecast?: IForecastRepository;
  private _propertyValue?: IPropertyValueRepository;

  constructor(private readonly db: DB) {}

  // Lazy getters — uncommented as each concrete repository is implemented
  get property(): IPropertyRepository {
    return (this._property ??= new PropertyRepository(this.db));
  }
  get bankAccount(): IBankAccountRepository {
    return (this._bankAccount ??= new BankAccountRepository(this.db));
  }
  get transactions(): ITransactionRepository {
    return (this._transactions ??= new TransactionRepository(this.db));
  }
  get loan(): ILoanRepository {
    return (this._loan ??= new LoanRepository(this.db));
  }
  get chat(): IChatRepository {
    return (this._chat ??= new ChatRepository(this.db));
  }
  get user(): IUserRepository {
    return (this._user ??= new UserRepository(this.db));
  }
  get recurring(): IRecurringRepository {
    return (this._recurring ??= new RecurringRepository(this.db));
  }
  get document(): IDocumentRepository {
    return (this._document ??= new DocumentRepository(this.db));
  }
  get compliance(): IComplianceRepository {
    return (this._compliance ??= new ComplianceRepository(this.db));
  }
  get email(): IEmailRepository {
    return (this._email ??= new EmailRepository(this.db));
  }
  get portfolio(): IPortfolioRepository {
    return (this._portfolio ??= new PortfolioRepository(this.db));
  }
  get scenario(): IScenarioRepository {
    return (this._scenario ??= new ScenarioRepository(this.db));
  }
  get task(): ITaskRepository {
    return (this._task ??= new TaskRepository(this.db));
  }
  get feedback(): IFeedbackRepository {
    return (this._feedback ??= new FeedbackRepository(this.db));
  }
  get team(): ITeamRepository {
    return (this._team ??= new TeamRepository(this.db));
  }
  get forecast(): IForecastRepository {
    return (this._forecast ??= new ForecastRepository(this.db));
  }
  get propertyValue(): IPropertyValueRepository {
    return (this._propertyValue ??= new PropertyValueRepository(this.db));
  }

  /** Execute callback in a transaction — all repositories inside share the tx */
  async transaction<T>(callback: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      return callback(new UnitOfWork(tx as unknown as DB));
    });
  }
}
